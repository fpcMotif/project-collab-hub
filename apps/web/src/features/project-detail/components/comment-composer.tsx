import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";

interface CommentComposerProps {
  members: string[];
  disabled?: boolean;
  onSubmit: (
    body: string,
    mentionedUserIds: string[]
  ) => Promise<{ ok: boolean; message?: string }>;
}

export const CommentComposer = ({
  members,
  disabled = false,
  onSubmit,
}: CommentComposerProps) => {
  const [body, setBody] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "error">("success");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredMembers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();
    return members
      .filter((member) => !mentionedUserIds.includes(member))
      .filter((member) => (query ? member.toLowerCase().includes(query) : true))
      .slice(0, 6);
  }, [memberQuery, members, mentionedUserIds]);

  const handleAddMention = (member: string) => {
    setMentionedUserIds((current) => [...current, member]);
    setMemberQuery("");
  };

  const handleRemoveMention = (member: string) => {
    setMentionedUserIds((current) => current.filter((item) => item !== member));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const result = await onSubmit(body, mentionedUserIds);
    setNotice(result.message ?? (result.ok ? "评论已发送" : "评论发送失败"));
    setNoticeTone(result.ok ? "success" : "error");

    if (result.ok) {
      setBody("");
      setMemberQuery("");
      setMentionedUserIds([]);
    }

    setIsSubmitting(false);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900">发表评论</h3>
        <span className="text-xs text-gray-400">支持结构化 @ 提醒</span>
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        disabled={disabled || isSubmitting}
        rows={4}
        placeholder="输入评论内容，记录项目上下文与需要跟进的事项…"
        className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
      />

      <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
        <label className="text-xs font-medium text-gray-500">提醒同事</label>
        <input
          value={memberQuery}
          onChange={(event) => setMemberQuery(event.target.value)}
          disabled={disabled || isSubmitting}
          placeholder="搜索成员名后点击加入 @ 列表"
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
        />

        {mentionedUserIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {mentionedUserIds.map((member) => (
              <button
                key={member}
                type="button"
                onClick={() => handleRemoveMention(member)}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                @{member}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}

        {filteredMembers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {filteredMembers.map((member) => (
              <button
                key={member}
                type="button"
                onClick={() => handleAddMention(member)}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-700"
              >
                添加 @{member}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {notice ? (
          <p
            className={cn(
              "text-sm",
              noticeTone === "success" ? "text-green-700" : "text-red-600"
            )}
          >
            {notice}
          </p>
        ) : (
          <span className="text-xs text-gray-400">
            评论会写入时间线，@ 将触发通知
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            handleSubmit();
          }}
          disabled={disabled || isSubmitting || body.trim().length === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSubmitting ? "发送中…" : "发送评论"}
        </button>
      </div>
    </div>
  );
};
