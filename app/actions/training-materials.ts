"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { createNotificationsForTeams } from "@/app/actions/notifications";
import { generateQuizDraft } from "@/lib/generate-quiz";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user?.isAdmin) throw new Error("Admin access required");
  return session;
}

export async function getModulesWithTopics(newHireId?: string) {
  const modules = await prisma.trainingModule.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    include: {
      topics: {
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: {
          acknowledgments: {
            where: newHireId ? { newHireId } : { newHireId: "" },
          },
          slides: { orderBy: { order: "asc" } },
          slideProgress: {
            where: newHireId ? { newHireId } : { newHireId: "" },
          },
          questions: {
            where: newHireId ? { isDraft: false } : undefined,
            orderBy: { order: "asc" },
            include: {
              answers: {
                where: newHireId ? { newHireId } : { newHireId: "" },
              },
            },
          },
        },
      },
    },
  });
  // Parse options JSON for each question
  return modules.map((m) => ({
    ...m,
    topics: m.topics.map((t) => ({
      ...t,
      questions: t.questions.map((q) => ({
        ...q,
        options: q.options ? (JSON.parse(q.options) as string[]) : null,
      })),
    })),
  }));
}

export async function createModule(formData: FormData) {
  const session = await requireAdmin();

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const category = formData.get("category") as string;
  const requiredForRoles = formData.get("requiredForRoles") as string; // JSON string or "ALL"
  const orderStr = formData.get("order") as string;

  if (!title || !category) return { error: "Title and category are required" };

  const maxOrder = await prisma.trainingModule.aggregate({ _max: { order: true } });
  const order = orderStr ? parseInt(orderStr) : (maxOrder._max.order ?? 0) + 1;

  await prisma.trainingModule.create({
    data: {
      title,
      description: description || null,
      category,
      order,
      requiredForRoles: requiredForRoles || "ALL",
      createdById: session.id,
    },
  });

  revalidatePath("/training-materials");
  return { success: true };
}

export async function editModule(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const category = formData.get("category") as string;
  const requiredForRoles = formData.get("requiredForRoles") as string;
  const orderStr = formData.get("order") as string;

  if (!id || !title || !category) return { error: "Missing required fields" };

  await prisma.trainingModule.update({
    where: { id },
    data: {
      title,
      description: description || null,
      category,
      requiredForRoles: requiredForRoles || "ALL",
      ...(orderStr ? { order: parseInt(orderStr) } : {}),
    },
  });

  revalidatePath("/training-materials");
  return { success: true };
}

export async function archiveModule(id: string) {
  await requireAdmin();
  await prisma.trainingModule.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/training-materials");
  return { success: true };
}

export async function createTopic(formData: FormData) {
  await requireAdmin();

  const moduleId = formData.get("moduleId") as string;
  const title = (formData.get("title") as string)?.trim();
  const fileLink = (formData.get("fileLink") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const orderStr = formData.get("order") as string;

  if (!moduleId || !title) return { error: "Module and title are required" };

  const maxOrder = await prisma.trainingTopic.aggregate({
    where: { moduleId },
    _max: { order: true },
  });
  const order = orderStr ? parseInt(orderStr) : (maxOrder._max.order ?? 0) + 1;

  const topic = await prisma.trainingTopic.create({
    data: {
      moduleId,
      title,
      fileLink: fileLink || null,
      content: content || null,
      order,
    },
    include: { module: true },
  });

  // Notify all new hires
  await createNotificationsForTeams(
    ["NEW_HIRE"],
    `New Training Topic: ${title}`,
    `A new topic "${title}" has been added to the module "${topic.module.title}". Go check it out!`,
    "/training-materials"
  );

  // Generate draft quiz questions async (best-effort)
  generateQuizDraft(topic.id, title, content || null).catch(() => {});

  revalidatePath("/training-materials");
  return { success: true };
}

export async function editTopic(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const title = (formData.get("title") as string)?.trim();
  const fileLink = (formData.get("fileLink") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const videoUrl = (formData.get("videoUrl") as string)?.trim();
  const orderStr = formData.get("order") as string;
  const minQStr = formData.get("minQuestionsRequired") as string;

  if (!id || !title) return { error: "Missing required fields" };

  const existing = await prisma.trainingTopic.findUnique({ where: { id }, select: { content: true } });
  const contentChanged = (content || null) !== (existing?.content ?? null);

  await prisma.trainingTopic.update({
    where: { id },
    data: {
      title,
      fileLink: fileLink || null,
      content: content || null,
      videoUrl: videoUrl || null,
      ...(orderStr ? { order: parseInt(orderStr) } : {}),
      ...(minQStr !== null && minQStr !== "" ? { minQuestionsRequired: Math.max(0, parseInt(minQStr) || 0) } : {}),
    },
  });

  // Regenerate draft quiz when content changes
  if (contentChanged && (content || title)) {
    // Delete existing draft questions, keep approved ones
    await prisma.topicQuestion.deleteMany({ where: { topicId: id, isDraft: true } });
    generateQuizDraft(id, title, content || null).catch(() => {});
  }

  revalidatePath("/training-materials");
  return { success: true };
}

export async function approveDraftQuestion(questionId: string) {
  await requireAdmin();
  await prisma.topicQuestion.update({ where: { id: questionId }, data: { isDraft: false } });
  revalidatePath("/training-materials");
  return { success: true };
}

export async function archiveTopic(id: string) {
  await requireAdmin();
  await prisma.trainingTopic.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/training-materials");
  return { success: true };
}

export async function acknowledgeTopic(topicId: string) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };
  if (!session.isNewHire) return { error: "Only new hires can acknowledge topics" };

  const newHire = await prisma.newHire.findUnique({
    where: { userId: session.id },
    select: { id: true },
  });
  if (!newHire) return { error: "New hire profile not found" };

  await prisma.topicAcknowledgment.upsert({
    where: { topicId_newHireId: { topicId, newHireId: newHire.id } },
    create: { topicId, newHireId: newHire.id },
    update: {},
  });

  revalidatePath("/training-materials");
  return { success: true };
}

export async function getAcknowledgmentStats() {
  const newHires = await prisma.newHire.findMany({
    where: { status: { not: "DELETED" }, userId: { not: null } },
    select: {
      id: true,
      name: true,
      role: true,
      topicAcknowledgments: { select: { topicId: true } },
      slideProgress: { select: { topicId: true, maxSlideReached: true } },
      questionAnswers: { select: { questionId: true, answer: true } },
    },
  });
  return newHires;
}

export async function addSlide(topicId: string, imageUrl: string, caption?: string) {
  await requireAdmin();
  const max = await prisma.topicSlide.aggregate({ where: { topicId }, _max: { order: true } });
  await prisma.topicSlide.create({
    data: { topicId, imageUrl, caption: caption || null, order: (max._max.order ?? -1) + 1 },
  });
  revalidatePath("/training-materials");
  return { success: true };
}

export async function createTopicForImport(moduleId: string, title: string): Promise<{ topicId: string } | { error: string }> {
  await requireAdmin();
  if (!moduleId || !title) return { error: "Module and title are required" };
  const maxOrder = await prisma.trainingTopic.aggregate({ where: { moduleId }, _max: { order: true } });
  const topic = await prisma.trainingTopic.create({
    data: { moduleId, title, order: (maxOrder._max.order ?? 0) + 1 },
  });
  revalidatePath("/training-materials");
  return { topicId: topic.id };
}

export async function addSlidesBatch(topicId: string, imageUrls: string[]): Promise<{ success: boolean }> {
  await requireAdmin();
  const max = await prisma.topicSlide.aggregate({ where: { topicId }, _max: { order: true } });
  let order = (max._max.order ?? -1) + 1;
  for (const imageUrl of imageUrls) {
    await prisma.topicSlide.create({ data: { topicId, imageUrl, order: order++ } });
  }
  revalidatePath("/training-materials");
  return { success: true };
}

export async function deleteSlide(slideId: string) {
  await requireAdmin();
  await prisma.topicSlide.delete({ where: { id: slideId } });
  revalidatePath("/training-materials");
  return { success: true };
}

export async function reorderSlides(topicId: string, orderedIds: string[]) {
  await requireAdmin();
  await Promise.all(
    orderedIds.map((id, index) => prisma.topicSlide.update({ where: { id }, data: { order: index } }))
  );
  revalidatePath("/training-materials");
  return { success: true };
}

export async function editSlideCaption(slideId: string, caption: string) {
  await requireAdmin();
  await prisma.topicSlide.update({ where: { id: slideId }, data: { caption: caption || null } });
  revalidatePath("/training-materials");
  return { success: true };
}

export async function updateSlideProgress(topicId: string, slideIndex: number) {
  const session = await getSession();
  if (!session || !session.isNewHire) return { error: "Unauthorized" };

  const newHire = await prisma.newHire.findUnique({ where: { userId: session.id }, select: { id: true } });
  if (!newHire) return { error: "New hire profile not found" };

  const existing = await prisma.slideProgress.findUnique({
    where: { topicId_newHireId: { topicId, newHireId: newHire.id } },
    select: { maxSlideReached: true },
  });

  await prisma.slideProgress.upsert({
    where: { topicId_newHireId: { topicId, newHireId: newHire.id } },
    create: { topicId, newHireId: newHire.id, maxSlideReached: slideIndex },
    update: { maxSlideReached: Math.max(existing?.maxSlideReached ?? 0, slideIndex) },
  });

  revalidatePath("/training-materials");
  return { success: true };
}

export async function reorderTopics(moduleId: string, orderedIds: string[]) {
  await requireAdmin();
  await Promise.all(
    orderedIds.map((id, index) => prisma.trainingTopic.update({ where: { id }, data: { order: index } }))
  );
  revalidatePath("/training-materials");
  return { success: true };
}

export async function reorderModules(orderedIds: string[]) {
  await requireAdmin();
  await Promise.all(
    orderedIds.map((id, index) => prisma.trainingModule.update({ where: { id }, data: { order: index } }))
  );
  revalidatePath("/training-materials");
  return { success: true };
}

export async function addQuestion(topicId: string, type: string, question: string) {
  await requireAdmin();
  const max = await prisma.topicQuestion.aggregate({ where: { topicId }, _max: { order: true } });
  const q = await prisma.topicQuestion.create({
    data: { topicId, type, question, order: (max._max.order ?? -1) + 1 },
  });
  revalidatePath("/training-materials");
  return { success: true, question: q };
}

export async function updateQuestion(
  questionId: string,
  question: string,
  options?: string[] | null,
  imageUrl?: string | null,
  gradingType?: string,
  correctAnswer?: string | null,
  isRequired?: boolean,
) {
  await requireAdmin();
  await prisma.topicQuestion.update({
    where: { id: questionId },
    data: {
      question,
      ...(options !== undefined ? { options: options && options.length > 0 ? JSON.stringify(options) : null } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(gradingType !== undefined ? { gradingType } : {}),
      ...(correctAnswer !== undefined ? { correctAnswer } : {}),
      ...(isRequired !== undefined ? { isRequired } : {}),
    },
  });
  revalidatePath("/training-materials");
  return { success: true };
}

export async function deleteQuestion(questionId: string) {
  await requireAdmin();
  await prisma.topicQuestionAnswer.deleteMany({ where: { questionId } });
  await prisma.topicQuestion.delete({ where: { id: questionId } });
  revalidatePath("/training-materials");
  return { success: true };
}

export async function saveQuestionAnswers(answers: { questionId: string; answer: string }[]) {
  const session = await getSession();
  if (!session || !session.isNewHire) return { error: "Unauthorized" };
  const newHire = await prisma.newHire.findUnique({ where: { userId: session.id }, select: { id: true } });
  if (!newHire) return { error: "New hire profile not found" };

  await Promise.all(
    answers.map(({ questionId, answer }) =>
      prisma.topicQuestionAnswer.upsert({
        where: { questionId_newHireId: { questionId, newHireId: newHire.id } },
        create: { questionId, newHireId: newHire.id, answer },
        update: { answer },
      })
    )
  );

  revalidatePath("/training-materials");
  return { success: true };
}
