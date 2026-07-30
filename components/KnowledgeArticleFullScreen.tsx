"use client";

import { ArticleCard, type Article, type UserAttempt } from "@/components/KnowledgeBase";

export default function KnowledgeArticleFullScreen({
  article,
  isAdmin,
  userAttempts,
  userReads,
}: {
  article: Article;
  isAdmin: boolean;
  userAttempts: UserAttempt[];
  userReads: string[];
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <a
        href="/knowledge"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Back to Knowledge Base
      </a>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <ArticleCard
          article={article}
          isAdmin={isAdmin}
          userAttempts={userAttempts}
          userReads={userReads}
          forceExpanded={true}
          inModal={false}
        />
      </div>
    </div>
  );
}
