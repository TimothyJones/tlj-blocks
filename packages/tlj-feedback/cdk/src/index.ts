import { join } from "node:path";
import { Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";

/**
 * Configuration for the {@link Feedback} construct.
 */
export interface FeedbackProps {
  /**
   * Email address that receives feedback notifications.
   *
   * An SNS email subscription is created for this address. After the first
   * deploy, AWS sends a one-time subscription-confirmation email here that
   * must be confirmed before any feedback is delivered.
   */
  feedbackEmail: string;

  /**
   * Display name for this app, used in the SNS topic's display name and as the
   * email subject prefix, e.g. `[MyApp] Bug Report: <title>`.
   *
   * @default "App"
   */
  appName?: string;

  /**
   * Explicit SNS topic name. Leave unset to let CloudFormation generate a
   * unique name (recommended unless you have a naming convention to follow).
   *
   * @default - a CloudFormation-generated name
   */
  topicName?: string;

  /**
   * Allowed CORS origins for the Function URL. In a browser, requests from
   * origins not listed here are blocked by the browser. Use specific origins
   * (e.g. your app's domain plus `http://localhost:5173` for local dev) to
   * avoid leaving the endpoint open to every site.
   *
   * @default ["*"]
   */
  allowedOrigins?: string[];

  /**
   * Lambda runtime for the receiver function.
   *
   * @default lambda.Runtime.NODEJS_22_X
   */
  runtime?: lambda.Runtime;
}

/**
 * A self-contained feedback receiver for an AWS CDK app.
 *
 * Provisions, in your stack:
 * - an {@link sns.Topic} with an email subscription to `feedbackEmail`;
 * - a {@link lambda.Function} (the handler is bundled into this package) that
 *   validates incoming feedback and publishes it to the topic; and
 * - a public {@link lambda.FunctionUrl} (CORS-enabled, `POST`) that the
 *   frontend calls.
 *
 * The endpoint accepts a JSON body of `{ type: "bug" | "feature", title,
 * description, email? }` and returns `{ success: true }` on success. Pair it
 * with the `tlj-feedback-client` package on the frontend, or POST to it
 * directly.
 *
 * @example
 * ```ts
 * import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
 * import { Construct } from "constructs";
 * import { Feedback } from "tlj-feedback-cdk";
 *
 * export class MyStack extends Stack {
 *   constructor(scope: Construct, id: string, props?: StackProps) {
 *     super(scope, id, props);
 *
 *     const feedback = new Feedback(this, "Feedback", {
 *       feedbackEmail: "team@example.com",
 *       appName: "MyApp",
 *       allowedOrigins: ["https://app.example.com", "http://localhost:5173"],
 *     });
 *
 *     // Hand this URL to the frontend (e.g. as a build-time env var).
 *     new CfnOutput(this, "FeedbackUrl", { value: feedback.functionUrl.url });
 *   }
 * }
 * ```
 */
export class Feedback extends Construct {
  /** The SNS topic feedback is published to. Subscribe more endpoints if needed. */
  readonly topic: sns.Topic;
  /** The receiver Lambda function. Exposed for adding alarms, env vars, etc. */
  readonly handler: lambda.Function;
  /** The public Function URL the client POSTs to. Read `.url` for the endpoint. */
  readonly functionUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: FeedbackProps) {
    super(scope, id);

    const appName = props.appName ?? "App";

    // The topic feedback is published to, with an email subscription. The
    // subscription must be confirmed (one-time email) before delivery starts.
    this.topic = new sns.Topic(this, "Topic", {
      topicName: props.topicName,
      displayName: `${appName} Feedback`,
    });
    this.topic.addSubscription(
      new snsSubscriptions.EmailSubscription(props.feedbackEmail),
    );

    // The receiver. The handler source is bundled into this package's `dist/`
    // at build time, so consumers don't need esbuild/bundling of their own.
    this.handler = new lambda.Function(this, "Handler", {
      runtime: props.runtime ?? lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(join(__dirname, "handler")),
      timeout: Duration.seconds(10),
      environment: {
        // Read by the handler at runtime — see src/handler/index.ts.
        FEEDBACK_TOPIC_ARN: this.topic.topicArn,
        FEEDBACK_APP_NAME: appName,
      },
    });

    // Least-privilege: the handler may publish to this topic and nothing else.
    this.topic.grantPublish(this.handler);

    // Public POST endpoint with CORS. authType NONE = no AWS auth required;
    // anyone with the URL can submit feedback.
    this.functionUrl = this.handler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: props.allowedOrigins ?? ["*"],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ["Content-Type", "Authorization"],
        maxAge: Duration.hours(1),
      },
    });
  }
}
