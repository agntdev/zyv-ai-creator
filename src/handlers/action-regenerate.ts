import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { askForTopic, createForTopic } from "./action-idea.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("action:regenerate", async (ctx) => {
  await ctx.answerCallbackQuery();
  const topic = ctx.session.topicText;
  if (!topic) {
    await askForTopic(ctx, "idea");
    return;
  }
  await createForTopic(ctx, topic);
});

export default composer;
