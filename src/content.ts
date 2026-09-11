import type { ContentOption, ContentPackage, Ctx } from "./bot.js";
import { adminChatId } from "./toolkit/index.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_HASHTAGS = 8;

let clock: () => number = () => Date.now();

/** Single clock seam for session timestamps; tests may install a deterministic clock. */
export function now(): number {
  return clock();
}

export function setClockForTests(nextClock: (() => number) | undefined): void {
  clock = nextClock ?? (() => Date.now());
}

function textGenKey(ctx: Ctx): string | undefined {
  const workerEnv = (ctx as Ctx & { env?: Record<string, unknown> }).env;
  const fromWorker = workerEnv?.TEXT_GEN_API_KEY;
  if (typeof fromWorker === "string" && fromWorker.trim()) return fromWorker.trim();
  const fromNode = typeof process === "undefined" ? undefined : process.env.TEXT_GEN_API_KEY;
  return fromNode?.trim() || undefined;
}

export function isValidTopic(topic: string): boolean {
  const clean = topic.trim();
  return clean.length >= 10 || clean.split(/\s+/).filter(Boolean).length >= 3;
}

export function isArabic(topic: string): boolean {
  return /[\u0600-\u06ff]/.test(topic);
}

function cleanField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > 0 && clean.length <= 500 ? clean : undefined;
}

function parsePackage(content: string): ContentPackage | undefined {
  const candidate = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const object = parsed as Record<string, unknown>;
  const idea = cleanField(object.idea);
  const hook = cleanField(object.hook_3s ?? object.hook);
  const sequence = cleanField(object.sequence);
  const title = cleanField(object.title);
  const description = cleanField(object.description);
  const hashtags = cleanField(object.hashtags);
  if (!idea || !hook || !sequence || !title || !description || !hashtags) return undefined;
  const limitedTags = hashtags.split(/\s+/).filter((tag) => tag.startsWith("#")).slice(0, MAX_HASHTAGS);
  if (limitedTags.length === 0) return undefined;
  return { idea, hook, sequence, title, description, hashtags: limitedTags.join(" ") };
}

function promptFor(topic: string, option: ContentOption, attempt: number): string {
  const emphasis: Record<ContentOption, string> = {
    idea: "ركّز على فكرة الفيديو كاملة.",
    hook: "اجعل الـ Hook هو الأقوى مع بقاء الحزمة كاملة.",
    script: "اجعل التسلسل أقرب إلى سكربت قصير قابل للتصوير.",
    title: "اجعل العنوان والوصف الأكثر جذباً مع بقاء الحزمة كاملة.",
    hashtags: "اختر هاشتاقات دقيقة وغير مكررة مع بقاء الحزمة كاملة.",
    fortnite: "اجعل الزاوية مناسبة لصانع محتوى Fortnite بالعربية.",
    content: "اقترح زاوية محتوى اجتماعي عملية وسريعة التنفيذ.",
  };
  return `أنت مساعد لصانعي الفيديوهات القصيرة العرب. أنشئ حزمة محتوى عربية آمنة وعملية لموضوع: ${JSON.stringify(topic)}. ${emphasis[option]} هذه المحاولة رقم ${attempt}، فاختر زاوية مختلفة عن المحاولات السابقة. أعد JSON صالحاً فقط دون Markdown بهذه المفاتيح الستة: idea, hook_3s, sequence, title, description, hashtags. اجعل hook مناسباً لأول 3 ثوانٍ، sequence مختصراً، والوصف مناسباً للنشر، والهاشتاقات من 3 إلى ${MAX_HASHTAGS} هاشتاقات.`;
}

export async function generatePackage(
  ctx: Ctx,
  topic: string,
  option: ContentOption,
  attempt: number,
): Promise<{ package?: ContentPackage; reason?: "missing" | "timeout" | "failed" | "unsafe" }> {
  const key = textGenKey(ctx);
  if (!key) return { reason: "missing" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: promptFor(topic, option, attempt) }],
        temperature: 0.9,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return { reason: "failed" };
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { reason: "unsafe" };
    const result = parsePackage(content);
    return result ? { package: result } : { reason: "unsafe" };
  } catch (error) {
    return { reason: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "failed" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function reportGenerationFailure(ctx: Ctx, reason: string): Promise<void> {
  const owner = adminChatId(ctx as unknown as { env?: Record<string, unknown> });
  if (!owner) return;
  try {
    await ctx.api.sendMessage(owner, `تعذّر توليد محتوى (${reason}).`);
  } catch {
    // Owner alerts are best-effort and must never interrupt the user's flow.
  }
}

export function packageText(output: ContentPackage, topic: string): string {
  const languageNote = isArabic(topic) ? "" : "\n\nملاحظة: النتائج بالعربية؛ قد تكون أدق إذا كتبت الموضوع بالعربية.";
  return `هذه حزمة جاهزة لتطويرها قبل النشر:\n\n1. فكرة الفيديو\n${output.idea}\n\n2. Hook أول 3 ثوانٍ\n${output.hook}\n\n3. تسلسل مختصر\n${output.sequence}\n\n4. عنوان جذاب\n${output.title}\n\n5. وصف مناسب\n${output.description}\n\n6. هاشتاقات\n${output.hashtags}${languageNote}`;
}
