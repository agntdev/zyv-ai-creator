import { Composer } from "grammy";
import type { ContentOption, Ctx } from "../bot.js";
import {
  generatePackage,
  isValidTopic,
  now,
  packageText,
  reportGenerationFailure,
} from "../content.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

const promptKeyboard = inlineKeyboard([[inlineButton("⬅️ القائمة الرئيسية", "menu:main")]]);
const outputKeyboard = inlineKeyboard([
  [inlineButton("🔄 توليد فكرة أخرى", "action:regenerate")],
  [inlineButton("⬅️ القائمة الرئيسية", "menu:main")],
]);

const optionCallbacks: Array<[string, ContentOption]> = [
  ["action:idea", "idea"],
  ["action:hook", "hook"],
  ["action:script", "script"],
  ["action:title", "title"],
  ["action:hashtags", "hashtags"],
  ["action:fortnite", "fortnite"],
  ["action:content", "content"],
];

export const TOPIC_PROMPT = "اكتب لي مجال الفيديو أو الموضوع.\nمثال: نصائح احتراف البناء في Fortnite";
export const INVALID_TOPIC = "احتاج موضوعاً أوضح قليلاً. اكتب 3 كلمات على الأقل أو 10 أحرف، مثل: نصائح احتراف البناء في Fortnite.";

export function failureText(reason: "missing" | "timeout" | "failed" | "unsafe"): string {
  if (reason === "missing") return "ميزة التوليد ليست مُعدّة بعد. جرّب لاحقاً أو ارجع للقائمة الرئيسية.";
  if (reason === "timeout") return "خدمة التوليد أخذت وقتاً أطول من المعتاد. جرّب مرة أخرى بعد قليل.";
  if (reason === "unsafe") return "لم نحصل على محتوى مناسب لهذا الموضوع. جرّب صياغة موضوع مختلف وواضح.";
  return "تعذّر الوصول إلى خدمة التوليد الآن. جرّب مرة أخرى بعد قليل.";
}

export async function askForTopic(ctx: Ctx, option: ContentOption): Promise<void> {
  ctx.session.activeOption = option;
  ctx.session.step = "awaiting_topic";
  await ctx.reply(TOPIC_PROMPT, {
    reply_markup: { force_reply: true, input_field_placeholder: "اكتب موضوع الفيديو هنا" },
  });
}

export async function createForTopic(ctx: Ctx, topic: string): Promise<void> {
  const option = ctx.session.activeOption ?? "idea";
  let attempt = (ctx.session.generationAttempt ?? 0) + 1;
  ctx.session.generationAttempt = attempt;
  await ctx.replyWithChatAction("typing");
  let result = await generatePackage(ctx, topic, option, attempt);
  // A second real request is preferable to showing an identical regeneration.
  if (result.package && ctx.session.lastOutput && packageText(result.package, topic) === packageText(ctx.session.lastOutput, topic)) {
    attempt += 1;
    ctx.session.generationAttempt = attempt;
    result = await generatePackage(ctx, topic, option, attempt);
  }
  if (!result.package) {
    await reportGenerationFailure(ctx, result.reason ?? "failed");
    await ctx.reply(failureText(result.reason ?? "failed"), {
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 حاول مرة أخرى", "action:regenerate")],
        [inlineButton("⬅️ القائمة الرئيسية", "menu:main")],
      ]),
    });
    return;
  }
  ctx.session.lastOutput = result.package;
  ctx.session.lastGeneratedAt = now();
  ctx.session.lastOutputSummary = result.package.title;
  await ctx.reply(packageText(result.package, topic), { reply_markup: outputKeyboard });
}

for (const [callback, option] of optionCallbacks) {
  composer.callbackQuery(callback, async (ctx) => {
    await ctx.answerCallbackQuery();
    await askForTopic(ctx, option);
  });
}

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_topic" || ctx.message.text.startsWith("/")) return next();
  const topic = ctx.message.text.trim();
  if (!isValidTopic(topic)) {
    await ctx.reply(INVALID_TOPIC, { reply_markup: promptKeyboard });
    return;
  }
  ctx.session.topicText = topic;
  ctx.session.step = undefined;
  await createForTopic(ctx, topic);
});

export default composer;
