import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript-test-compiler";

// Execute the actual worker with provider/database seams replaced. No network or sends.
const source = ts
  .transpileModule(
    readFileSync(
      new URL("../lib/notification-outbox.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    },
  )
  .outputText.replace(/^import .*;\n/gm, "");

for (const scenario of [
  {
    name: "irrelevant date",
    relevant: false,
    push: { delivered: true, retryable: false },
    expected: "skipped",
  },
  {
    name: "no subscription",
    relevant: true,
    push: { delivered: false, retryable: false, reason: "no_subscription" },
    expected: "skipped",
  },
  {
    name: "provider accepted",
    relevant: true,
    push: { delivered: true, retryable: false },
    expected: "delivered",
  },
  {
    name: "provider retry",
    relevant: true,
    push: { delivered: false, retryable: true },
    expected: "retried",
  },
  {
    name: "skipped Love message",
    type: "love_chat_message",
    relevant: true,
    love: { complete: true, delivered: false },
    expected: "skipped",
  },
  {
    name: "delivered Love message",
    type: "love_chat_message",
    relevant: true,
    love: { complete: true, delivered: true },
    expected: "delivered",
  },
])
  test(`outbox accounts for ${scenario.name}`, async () => {
    const fixture = JSON.stringify(scenario);
    const module = await import(
      "data:text/javascript;base64," +
        Buffer.from(
          `
    const scenario=${fixture};
    export const calls=[];
    const supabaseAdmin={rpc:async(name,args)=>{
      calls.push({name,args});
      if(name==='claim_notification_jobs')return {data:[{id:'job',job_type:scenario.type||'push',entity_type:'date_plan',actor_id:'actor',payload:{messageId:'message'}}]};
      return {data:name==='fail_notification_job'?'retry':true};
    }};
    const dateNoticeStillRelevant=async()=>scenario.relevant;
    const sendPushToUserDetailed=async()=>scenario.push;
    const deliverLoveMessageNotification=async()=>scenario.love;
    ${source}
  `,
        ).toString("base64")
    );
    const result = await module.processNotificationOutbox();
    assert.equal(result[scenario.expected], 1);
    assert.equal(result.delivered, scenario.expected === "delivered" ? 1 : 0);
    assert.equal(
      module.calls.at(-1).name,
      scenario.expected === "delivered"
        ? "complete_notification_job"
        : scenario.expected === "skipped"
          ? "skip_notification_job"
          : "fail_notification_job",
    );
  });
