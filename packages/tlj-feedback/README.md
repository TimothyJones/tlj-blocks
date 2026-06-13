# tlj-feedback

A building block for collecting user feedback ("bug" / "feature" reports) and
delivering it to your inbox. It comes in two independently-publishable packages:

| Package                           | Runs on   | Responsibility                                                                  |
| --------------------------------- | --------- | ------------------------------------------------------------------------------- |
| [`tlj-feedback-client`](./client) | frontend  | Dependency-free connector that POSTs `{ type, title, description }` feedback.   |
| [`tlj-feedback-cdk`](./cdk)       | AWS (CDK) | Construct: a Lambda Function URL that publishes feedback to an SNS email topic. |

## How they fit together

```
 frontend ──submitFeedback()──▶ Lambda Function URL ──▶ SNS topic ──▶ email
 (tlj-feedback-client)            (tlj-feedback-cdk)
```

1. Deploy `tlj-feedback-cdk` in your CDK stack; it outputs a Function URL.
2. Confirm the SNS email subscription (one-time AWS email).
3. Pass that URL to `tlj-feedback-client` in your frontend.

See each package's README for full usage and API details:

- **[CDK construct →](./cdk/README.md)** — deploy, props, HTTP contract, extension.
- **[Client connector →](./client/README.md)** — `submitFeedback` options and API.
