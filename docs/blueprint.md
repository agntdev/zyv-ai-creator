# ZYV AI Creator — Bot specification

**Archetype:** content

**Voice:** warm and encouraging — write every user-facing message, button label, error, and empty state in this voice.

بوت Telegram بالعربية يساعد صانعي محتوى الفيديو القصير على توليد حزمة محتوى كاملة (فكرة، Hook، تسلسل مختصر، عنوان، وصف، هاشتاقات) بسرعة عبر أزرار تفاعلية وإمكانية إعادة التوليد والعودة للقائمة دون تخزين تاريخ طويل للمستخدمين.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Arabic short-form video creators (YouTube Shorts, TikTok, Reels)
- Fortnite content creators and gaming creators in Arabic
- Arabic-speaking social creators looking for fast idea generation

## Success criteria

- A user can produce a complete content package (idea, 3s Hook, short sequence, title, description, hashtags) in a single dialog within 30 seconds of providing a valid topic.
- Regenerate action returns a new distinct package based on the same session topic without losing the active menu state.
- Session state (active option + last topic) persists for the user's short session and enables the 'regenerate' and 'back to menu' flows.
- Validation rejects empty/too-short topics and prompts for clarification; bot responds gracefully when the text-generation API is missing or fails.

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu and show welcome message and primary actions
- **🚀 ابدأ** (button, actor: user, callback: main:start) — Go to the main action menu with content options
  - outputs: main_menu
- **ℹ️ عن البوت** (button, actor: user, callback: main:about) — Show short about/help text describing capabilities and disclaimer
  - outputs: about_text
- **🎬 فكرة فيديو** (button, actor: user, callback: action:idea) — Start flow to generate full content package (asks for topic)
  - inputs: topic_text
  - outputs: template_output
- **🔄 إعادة التوليد** (button, actor: user, callback: action:regenerate) — Regenerate outputs using last valid topic in the user's session
  - inputs: session.topic
  - outputs: template_output

## Flows

### Onboarding / Start
_Trigger:_ /start or button 🚀 ابدأ

1. Send welcome message in Arabic with concise description and privacy note
2. Show two inline buttons: 🚀 ابدأ and ℹ️ عن البوت
3. If user taps 🚀 ابدأ -> open main menu (next flow)

_Data touched:_ User session

### Main Menu
_Trigger:_ callback main:start

1. Display main menu as inline keyboard with options: 🎬 فكرة فيديو, ⚡ Hook قوي, 📝 كتابة سكربت, 🏷️ عنوان ووصف, #️⃣ هاشتاقات, 🎮 أفكار Fortnite, 💡 أفكار محتوى, 🔄 إعادة التوليد
2. Each option is a callback that initiates 'Request Topic' step

_Data touched:_ Interaction buttons, User session

### Request Topic (validation)
_Trigger:_ user selects content option

1. Prompt user: 'اكتب لي مجال الفيديو أو الموضوع' using ForceReply or instruct to type
2. Validate input: must be >= 3 words OR >= 10 characters
3. If invalid -> send clarifying prompt and do not proceed
4. If valid -> persist topic in session and call text-generation integration to create outputs

_Data touched:_ User session

### Generate Content Package
_Trigger:_ valid topic received

1. Call text-generation API with language=Arabic and prompt template for: فكرة الفيديو, Hook أول 3 ثوانٍ, تسلسل مختصر, عنوان جذاب, وصف مناسب, هاشتاقات
2. Receive and sanitize output (ensure non-empty, safe content)
3. Send organized message to user with numbered sections (1–6)
4. Show inline buttons: 🔄 توليد فكرة أخرى and ⬅️ القائمة الرئيسية

_Data touched:_ Template outputs, User session

### Regenerate
_Trigger:_ callback action:regenerate

1. Check session for last valid topic; if none -> prompt for topic
2. If topic exists -> call generation API with same or refreshed randomness parameter
3. Send new package and update session temporary output

_Data touched:_ User session, Template outputs

### About / Help
_Trigger:_ callback main:about or /help

1. Send brief capabilities description in Arabic, usage tips, and disclaimer that outputs are automated and should be reviewed
2. Show button to return to main menu

### API failure / Missing Key
_Trigger:_ text-generation API error or missing env

1. Send user-friendly Arabic error: explain temporary failure and provide retry/back-to-menu buttons
2. Log error for owner if ADMIN_CHAT_ID configured (optional)

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **TEXT_GEN_API_KEY** — API key for the text-generation service you want the bot to call
  - may be UNSET at runtime: the bot must still start, and the feature needing TEXT_GEN_API_KEY must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **User session** _(retention: session)_ — Short-lived per-user session storing the active menu choice and the last valid topic to enable regenerate and return-to-menu flows
  - fields: user_id, active_option, topic_text, last_generated_at, last_output_summary
- **Template outputs** _(retention: session)_ — Generated content package for the requested topic: idea, 3s hook, short sequence, title, description, hashtags (kept only for the session to support regenerate and immediate review)
  - fields: idea, hook_3s, sequence, title, description, hashtags, generated_at, source_meta
- **Interaction buttons** _(retention: none)_ — Definitions of inline keyboard labels and callback_data for navigation and actions (no personal data)
  - fields: label, callback_data, target_flow

## Integrations

- **Telegram** (required) — Bot API messaging, inline keyboards, callbacks, ForceReply
- **Text-generation API (owner-provided)** (required) — Produce the idea/hook/sequence/title/description/hashtags content
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Provide TEXT_GEN_API_KEY (required) to enable text generation
- Edit welcome/about message text and small usage tips
- Toggle optional ADMIN_CHAT_ID to receive user error reports or opt-ins (enable/disable)
- Set input validation thresholds (min words or min chars) and maximum hashtags count

## Notifications

- User: receive generated content message with organized sections after a successful generation
- User: receive validation prompts when topic input is empty/too short
- Owner (optional, if ADMIN_CHAT_ID configured): receive error reports when generation fails or when users submit abuse reports

## Permissions & privacy

- No long-term storage of user conversation history by default — only short session data retained to support regenerate and menu navigation.
- Bot must not request or store sensitive personal data (PII).
- Generated content is automated; users are warned to review outputs before publication.
- If ADMIN_CHAT_ID is enabled, owner will receive only error/notification messages, not full conversation history unless expressly configured.

## Edge cases

- User submits empty, whitespace, or too-short topic — bot prompts for clarification and gives examples.
- User sends non-Arabic topic — bot accepts but notes that default language is Arabic and results may be better in Arabic; provide a button to switch to English if owner enables it later.
- Text-generation API missing key or rate-limited — bot shows friendly Arabic error with retry/back-to-menu buttons; optionally notify owner if ADMIN_CHAT_ID is set.
- Generation returns unsafe, disallowed, or empty content — bot replaces with a safe fallback message and asks user to try a different topic.
- High concurrency or slow API responses — bot uses a short timeout and informs the user to retry if the service is slow.

## Required tests

- Dialog-level acceptance: /start -> 🚀 ابدأ -> choose 🎬 فكرة فيديو -> provide valid topic -> receive full 6-part package and action buttons.
- Validation test: provide empty or very short input -> bot requests clarification and blocks generation.
- Regenerate test: after a successful generation, tap 🔄 توليد فكرة أخرى -> receive a different (not identical) package and session topic remains the same.
- Navigation test: after generation, tap ⬅️ القائمة الرئيسية -> main menu returns and options are reachable.
- API-missing-key test: run bot without TEXT_GEN_API_KEY -> bot responds with friendly error and does not crash; admin notification not sent if ADMIN_CHAT_ID not set.

## Assumptions

- Default language is Arabic; English support is planned but not implemented initially.
- Owner will supply a text-generation API key in TEXT_GEN_API_KEY environment variable.
- No payments, subscriptions, or long-term storage required initially.
- Session persistence is ephemeral (in-memory or short DB TTL) to enable regenerate during a short user session.
- Owner wants inline keyboard navigation for menus and requests, and ForceReply for free-form topic text.
