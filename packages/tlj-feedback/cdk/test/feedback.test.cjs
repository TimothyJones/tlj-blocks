const test = require("node:test");
const assert = require("node:assert/strict");
const { App, Stack } = require("aws-cdk-lib");
const { Template } = require("aws-cdk-lib/assertions");
const { Feedback } = require("../dist/index.js");

test("provisions a topic, email subscription, lambda and function url", () => {
  const app = new App();
  const stack = new Stack(app, "TestStack");
  new Feedback(stack, "Feedback", {
    feedbackEmail: "test@example.com",
    appName: "Demo",
  });

  const template = Template.fromStack(stack);

  template.resourceCountIs("AWS::SNS::Topic", 1);
  template.hasResourceProperties("AWS::SNS::Subscription", {
    Protocol: "email",
    Endpoint: "test@example.com",
  });
  template.resourceCountIs("AWS::Lambda::Function", 1);
  template.resourceCountIs("AWS::Lambda::Url", 1);
  template.hasResourceProperties("AWS::Lambda::Function", {
    Environment: {
      Variables: {
        FEEDBACK_APP_NAME: "Demo",
      },
    },
  });
});
