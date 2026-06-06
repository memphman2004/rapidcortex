#!/usr/bin/env ruby
# frozen_string_literal: true

# Partitions infra/nested/stack-app-sam.yaml into core (stack-app-sam.yaml) and
# comms/platform (stack-app-sam-2.yaml). Run: ruby scripts/split-stack-app-sam.rb

require "fileutils"

ROOT = File.expand_path("..", __dir__)
SRC = File.join(ROOT, "infra/nested/stack-app-sam.yaml")
OUT1 = File.join(ROOT, "infra/nested/stack-app-sam.yaml")
OUT2 = File.join(ROOT, "infra/nested/stack-app-sam-2.yaml")
BACKUP = File.join(ROOT, "infra/nested/stack-app-sam.before-split.yaml")

# Lambdas + supporting resources that move to stack 2 only (not duplicated on stack 1).
STACK2_ONLY = %w[
  ExternalV1HttpFunction
  RcLiteV1HttpFunction
  StartLanguageSessionFunction
  FinalizeLanguageSessionFunction
  GetLanguageSessionStatusFunction
  CallIntelligenceLanguagesFunction
  DemoScenariosFunction
  IntegrationStatusFunction
  StartDemoScenarioFunction
  ListWellnessFlagsFunction
  AcknowledgeTraumaFlagFunction
  GetCallerCardFunction
  CreatePremiseNoteFunction
  GetSupervisorPerformanceMetricsFunction
  GetDispatcherPerformanceDetailFunction
  PostDispatcherCoachingNoteFunction
  GetAdminAnalyticsFunction
  PostAdminAnalyticsRefreshFunction
  GetAdminAnalyticsCsvFunction
  AggregateAnalyticsFunction
  ListAuditEventsFunction
  PostAgencySharePartnerFunction
  VideoAssistIncidentsHttpFunction
  VideoAssistPublicHttpFunction
  SilentTextIncidentsHttpFunction
  SilentTextPublicHttpFunction
  LiveVideoSmsRoutingFailedMetricFilter
  KvsWebRtcBrowserTokenRole
  LiveVideoIncidentsHttpLogGroup
  LiveVideoIncidentsHttpFunction
  LiveVideoPublicHttpFunction
  LiveVideoIncidentsHttpErrorsAlarm
  LiveVideoPublicHttpErrorsAlarm
  AgencyAdminListAccessOverridesFunction
  AgencyAdminPostAccessOverridesFunction
  AgencyAdminGetAccessOverrideFunction
  AgencyAdminPatchAccessOverrideRevokeFunction
  AgencyAdminListUserAccessOverridesFunction
  AgencyAdminListApiClientsFunction
  AgencyAdminPostApiClientsFunction
  AgencyAdminPatchApiClientFunction
  AgencyAdminRotateApiClientFunction
  AgencyAdminListWebhooksFunction
  AgencyAdminPostWebhooksFunction
  RcAdminListApiClientsFunction
  GetDesktopReleasesOverviewFunction
  PostDesktopReleaseSignedUrlFunction
  PostContactSalesLeadFunction
  RetentionExecutorFunction
  RetentionSchedulerInvokeRole
  RetentionExecutorSchedule
  RetentionExecutorInvokePermission
  GetPlatformSummaryFunction
  GetPlatformAuditEventsFunction
  AppManagedPolicyCognitoAgencyAdminUserPoolReads
].freeze

STACK2_SET = STACK2_ONLY.to_h { |n| [n, true] }.freeze

# Duplicated into stack 2 (stack 1 retains originals): shared IAM + HTTP API surface.
STACK2_DUP_FROM_STACK1 = %w[
  AppManagedPolicyDynamoLambdaCrudShardA
  AppManagedPolicyDynamoLambdaCrudShardB
  AppManagedPolicyDynamoLambdaCrudShardC
  AppManagedPolicyS3ApplicationBucketsCrud
  AppManagedPolicyBedrockAiAndQaFoundationModels
  AppManagedPolicyBedrockQaFoundationModelOnly
  AppManagedPolicySecretsMultilingualScopedRead
  AppManagedPolicySecretsAnalyzeProvidersRead
  AppManagedPolicyComprehendTranslateRegionalDetect
  AppManagedPolicyOpsAlertsSnsPublishOnly
  AppManagedPolicySesBillingSenderIdentityEmails
  AppManagedPolicyTranscribeIncidentAudioJobsReadWrite
  OpsAlertsTopic
  OpsAlertsEmailSubscription
  OpsAlertsSmsSubscription
  Api
  ApiWebAcl
  ApiWebAclAssociation
  ApiManagedCertificate
  ApiCustomDomain
  ApiCustomDomainMapping
  ApiDomainDnsRecordA
  ApiDomainDnsRecordAAAA
].freeze

def resource_spans(resources_section)
  lines = resources_section.lines
  raise "bad Resources" unless lines.first.strip == "Resources:"

  body = lines[1..].map(&:chomp)
  out = []
  idx = 0
  while idx < body.size
    m = body[idx].match(/^  ([A-Za-z0-9]+):\s*$/)
    unless m
      idx += 1
      next
    end
    nm = m[1]
    s = idx
    idx += 1
    while idx < body.size && !body[idx].match(/^  ([A-Za-z0-9]+):\s*$/)
      idx += 1
    end
    blobs = body[s...idx].map { |l| "#{l}\n" }.join
    out << [nm, blobs]
  end
  out
end

abort("missing #{SRC}") unless File.file?(SRC)
mono = File.read(SRC, encoding: "UTF-8")

r_idx = mono.index(/^Resources:\s*$/) or abort("no Resources")
o_idx = mono.index(/^Outputs:\s*$/) or abort("no Outputs")

prefix = mono[0...r_idx]
resources_section = mono[r_idx...o_idx]
outputs_and_rest = mono[o_idx..]

spans = resource_spans(resources_section)
by_name = spans.to_h

missing = (STACK2_ONLY + STACK2_DUP_FROM_STACK1).uniq.reject { |n| by_name.key?(n) }
abort("Unknown resource names: #{missing.join(', ')}") if missing.any?

stack1_bodies = []
stack2_bodies = []
dup_bodies = STACK2_DUP_FROM_STACK1.map { |n| by_name.fetch(n) }

spans.each do |name, blob|
  if STACK2_SET[name]
    stack2_bodies << blob
  else
    stack1_bodies << blob
  end
end

stack1_resources = +"Resources:\n#{stack1_bodies.join}"
stack2_resources = +"Resources:\n#{dup_bodies.join}#{stack2_bodies.join}"

# --- Stack 2 prefix: imported Cognito parameters + patch Globals env ---
insert_anchor = <<~'YAML'
  CognitoGenerateSecret:
    Type: String
    Default: "false"
    AllowedValues: ["true", "false"]
    Description: Set true for confidential server-side clients; web SPAs use false.
YAML
stack2_prefix = prefix.dup
unless stack2_prefix.include?("ImportedCognitoUserPoolId:")
  anchor = "  SnsEmailSubscription:\n"
  unless stack2_prefix.include?(anchor)
    abort("splitter: anchor for param insert not found (SnsEmailSubscription)")
  end

  stack2_params = [
    "  # --- Imported from primary SAM root stack (deploy stack 1 first); see scripts/deploy2.sh ---\n",
    "  ImportedCognitoUserPoolId:\n",
    "    Type: String\n",
    "    Description: Cognito User Pool ID from the primary stack nested AppSamStack.\n",
    "  ImportedCognitoWebClientId:\n",
    "    Type: String\n",
    "    Description: Cognito web app client ID from the primary stack.\n",
    "  ImportedCognitoNativeClientId:\n",
    "    Type: String\n",
    "    Default: \"\"\n",
    "    Description: Cognito native client ID (PKCE); optional.\n",
    "  ImportedCognitoIssuer:\n",
    "    Type: String\n",
    "    Description: JWT issuer URL for HttpApi authorizer (same as primary stack CognitoIssuer output).\n",
    "\n"
  ].join
  stack2_prefix.sub!(anchor, stack2_params + anchor)
end

stack2_prefix.gsub!(
  "COGNITO_USER_POOL_ID: !Ref CognitoUserPool\n",
  "COGNITO_USER_POOL_ID: !Ref ImportedCognitoUserPoolId\n"
)
stack2_prefix.gsub!(
  "COGNITO_CLIENT_ID: !Ref CognitoUserPoolClient\n",
  "COGNITO_CLIENT_ID: !Ref ImportedCognitoWebClientId\n"
)

# Stack 2 SNS topic physical name (avoid collision with stack 1 OpsAlertsTopic)
stack2_resources.gsub!(
  "- !Sub \"${AppName}-ops-${DeploymentStage}-${AWS::AccountId}\"",
  "- !Sub \"${AppName}-ops2-${DeploymentStage}-${AWS::AccountId}\""
)

# Stack 2 managed policy logical names unchanged; physical ManagedPolicyName disambiguation
stack2_resources.gsub!(
  '${AppName}-lambda-ddb-crud-${DeploymentStage}-',
  '${AppName}-sam2-lambda-ddb-crud-${DeploymentStage}-'
)
stack2_resources.gsub!(
  '${AppName}-lambda-s3-app-${DeploymentStage}',
  '${AppName}-sam2-lambda-s3-app-${DeploymentStage}'
)
stack2_resources.gsub!(
  '${AppName}-lambda-bedrock-aiqa-${DeploymentStage}',
  '${AppName}-sam2-lambda-bedrock-aiqa-${DeploymentStage}'
)
stack2_resources.gsub!(
  '${AppName}-lambda-bedrock-qaonly-${DeploymentStage}',
  '${AppName}-sam2-lambda-bedrock-qaonly-${DeploymentStage}'
)
stack2_resources.gsub!(
  '${AppName}-lambda-sec-ml-scoped-${DeploymentStage}',
  '${AppName}-sam2-lambda-sec-ml-scoped-${DeploymentStage}'
)
stack2_resources.gsub!(
  '${AppName}-lambda-sec-analyze-read-${DeploymentStage}',
  '${AppName}-sam2-lambda-sec-analyze-read-${DeploymentStage}'
)
stack2_resources.gsub!(
  '${AppName}-lambda-comprehend-translate-${DeploymentStage}',
  '${AppName}-sam2-lambda-comprehend-translate-${DeploymentStage}'
)
stack2_resources.gsub!(
  '${AppName}-lambda-ops-sns-${DeploymentStage}',
  '${AppName}-sam2-lambda-ops-sns-${DeploymentStage}'
)
stack2_resources.gsub!(
  '${AppName}-lambda-ses-billing-${DeploymentStage}',
  '${AppName}-sam2-lambda-ses-billing-${DeploymentStage}'
)
stack2_resources.gsub!(
  '${AppName}-lambda-transcribe-audio-${DeploymentStage}',
  '${AppName}-sam2-lambda-transcribe-audio-${DeploymentStage}'
)

# WAF web ACL name uniqueness
stack2_resources.gsub!(
  '${AppName}-httpapi-waf-${DeploymentStage}',
  '${AppName}-httpapi2-waf-${DeploymentStage}'
)

# HttpApi JWT authorizer uses imported issuer + audience (no CognitoUserPool resource in stack 2)
stack2_resources.gsub!(
  "issuer: !Sub https://cognito-idp.${AWS::Region}.amazonaws.com/${CognitoUserPool}\n              audience:\n                - !Ref CognitoUserPoolClient",
  "issuer: !Ref ImportedCognitoIssuer\n              audience:\n                - !Ref ImportedCognitoWebClientId"
)

# Inline IAM that referenced the pool resource in stack 1
stack2_resources.gsub!(
  "Resource: !GetAtt CognitoUserPool.Arn",
  'Resource: !Sub "arn:aws:cognito-idp:${AWS::Region}:${AWS::AccountId}:userpool/${ImportedCognitoUserPoolId}"'
)

stack2_resources.gsub!(
  '${AppName}-lambda-cognito-agadm-${DeploymentStage}',
  '${AppName}-sam2-lambda-cognito-agadm-${DeploymentStage}'
)

stack1_outputs = outputs_and_rest.dup
%w[
  ListWellnessFlagsFunctionName
  AcknowledgeTraumaFlagFunctionName
  GetCallerCardFunctionName
  CreatePremiseNoteFunctionName
].each do |out|
  stack1_outputs.sub!(/^  #{out}:\n(?:    .*\n)+?(?=^  [A-Za-z0-9]+:\s*$|\z)/m, "")
end

stack2_outputs = <<~YAML

Outputs:
  OpsAlertsTopicArn:
    Description: SNS topic ARN for CloudWatch alarm notifications (stack 2 ops).
    Value: !Ref OpsAlertsTopic
  HttpApiUrl:
    Description: HTTP API base URL (stack 2)
    Value: !GetAtt Api.ApiEndpoint
  HttpApiId:
    Description: HTTP API ID (stack 2)
    Value: !Ref Api
  ApiWebAclArn:
    Condition: HasApiWaf
    Description: Regional WAF web ACL attached to stack 2 HTTP API.
    Value: !GetAtt ApiWebAcl.Arn
  ApiCustomDomainUrl:
    Condition: HasApiCustomDomainCert
    Description: Stack 2 API custom domain URL.
    Value: !Sub "https://${ApiSubdomainPrefix}.${RootDomainName}"
  ApiTlsCertificateArn:
    Condition: HasApiCustomDomainCert
    Description: ACM certificate ARN for stack 2 API custom domain.
    Value: !If [HasImportedApiCert, !Ref ApiDomainCertificateArn, !Ref ApiManagedCertificate]
  ListWellnessFlagsFunctionName:
    Value: !Ref ListWellnessFlagsFunction
  AcknowledgeTraumaFlagFunctionName:
    Value: !Ref AcknowledgeTraumaFlagFunction
  GetCallerCardFunctionName:
    Value: !Ref GetCallerCardFunction
  CreatePremiseNoteFunctionName:
    Value: !Ref CreatePremiseNoteFunction
YAML

FileUtils.cp(SRC, BACKUP) unless File.file?(BACKUP)

File.write(OUT1, prefix + stack1_resources + stack1_outputs, encoding: "UTF-8")
File.write(OUT2, stack2_prefix + stack2_resources + stack2_outputs, encoding: "UTF-8")

puts "Wrote #{OUT1}"
puts "Wrote #{OUT2}"
puts "Backup: #{BACKUP}" if File.file?(BACKUP)
