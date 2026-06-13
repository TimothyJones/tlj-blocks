/**
 * Lambda handler for the {@link Feedback} construct's Function URL.
 *
 * Bundled into this package's `dist/handler/` at build time (esbuild) and
 * deployed by the construct — it is not a public entry point of the package.
 *
 * HTTP contract (POST, JSON):
 * - Request body: `{ type: "bug" | "feature", title, description, email? }`
 * - `200 { success: true }` on success
 * - `400 { error: "ValidationError", message }` for a missing/invalid body
 * - `500 { error: "ConfigError" | "InternalError", message }` otherwise
 *
 * Environment variables (set by the construct):
 * - `FEEDBACK_TOPIC_ARN` (required) — SNS topic to publish to
 * - `FEEDBACK_APP_NAME` (optional, default `"App"`) — email subject prefix
 */
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

const sns = new SNSClient({});

type FeedbackType = "bug" | "feature";

interface FeedbackBody {
  type: FeedbackType;
  title: string;
  description: string;
  /** Optional reporter email; included in the notification when present. */
  email?: string;
}

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const topicArn = process.env.FEEDBACK_TOPIC_ARN;
  if (!topicArn) {
    return json(500, {
      error: "ConfigError",
      message: "Feedback topic not configured",
    });
  }

  if (!event.body) {
    return json(400, {
      error: "ValidationError",
      message: "Request body is required",
    });
  }

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf-8")
    : event.body;

  let parsed: FeedbackBody;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json(400, {
      error: "ValidationError",
      message: "Invalid JSON body",
    });
  }

  if (
    (parsed.type !== "bug" && parsed.type !== "feature") ||
    !parsed.title ||
    !parsed.description
  ) {
    return json(400, {
      error: "ValidationError",
      message: "Body must include type (bug|feature), title, and description",
    });
  }

  const appName = process.env.FEEDBACK_APP_NAME ?? "App";
  const typeLabel = parsed.type === "bug" ? "Bug Report" : "Feature Request";
  const subject = `[${appName}] ${typeLabel}: ${parsed.title}`.slice(0, 100);
  const message = [
    `Type: ${typeLabel}`,
    `From: ${parsed.email ?? "unknown"}`,
    `Title: ${parsed.title}`,
    "",
    parsed.description,
  ].join("\n");

  try {
    await sns.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: subject,
        Message: message,
      }),
    );
    return json(200, { success: true });
  } catch (err) {
    console.error("Failed to publish feedback:", err);
    return json(500, {
      error: "InternalError",
      message: "Failed to submit feedback",
    });
  }
}
