import { join } from "node:path";
import { Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";

export interface FeedbackProps {
  /** Email address that receives feedback notifications (via SNS). */
  feedbackEmail: string;
  /**
   * Display name used in the SNS topic display name and the email subject
   * prefix, e.g. `[MyApp] Bug Report: ...`. Defaults to `"App"`.
   */
  appName?: string;
  /** Explicit SNS topic name. Defaults to a CloudFormation-generated name. */
  topicName?: string;
  /** Allowed CORS origins for the Function URL. Defaults to `["*"]`. */
  allowedOrigins?: string[];
  /** Lambda runtime for the receiver. Defaults to `NODEJS_22_X`. */
  runtime?: lambda.Runtime;
}

/**
 * Provisions a feedback receiver: a Lambda (behind a Function URL) that accepts
 * `{ type, title, description }` POSTs and publishes them to an SNS topic, which
 * emails `feedbackEmail`.
 *
 * Pair with the `tlj-feedback-client` package on the frontend.
 */
export class Feedback extends Construct {
  /** The SNS topic feedback is published to. */
  readonly topic: sns.Topic;
  /** The receiver Lambda function. */
  readonly handler: lambda.Function;
  /** The public Function URL the client POSTs to. */
  readonly functionUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: FeedbackProps) {
    super(scope, id);

    const appName = props.appName ?? "App";

    this.topic = new sns.Topic(this, "Topic", {
      topicName: props.topicName,
      displayName: `${appName} Feedback`,
    });
    this.topic.addSubscription(
      new snsSubscriptions.EmailSubscription(props.feedbackEmail),
    );

    this.handler = new lambda.Function(this, "Handler", {
      runtime: props.runtime ?? lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(join(__dirname, "handler")),
      timeout: Duration.seconds(10),
      environment: {
        FEEDBACK_TOPIC_ARN: this.topic.topicArn,
        FEEDBACK_APP_NAME: appName,
      },
    });

    this.topic.grantPublish(this.handler);

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
