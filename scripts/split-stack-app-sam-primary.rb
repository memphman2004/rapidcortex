#!/usr/bin/env ruby
# frozen_string_literal: true

# Partitions infra/nested/stack-app-sam.yaml (AppSamStackV2 — stack 1) into:
#   stack-app-sam.yaml    (retained: incident, CAD, QA, media, user/agency, campus, venue)
#   stack-app-sam-4.yaml  (new: billing/payments + Ring Connect)
#
# Usage: ruby scripts/split-stack-app-sam-primary.rb

require "fileutils"

ROOT = File.expand_path("..", __dir__)
SRC = File.join(ROOT, "infra/nested/stack-app-sam.yaml")
OUT1 = File.join(ROOT, "infra/nested/stack-app-sam.yaml")
OUT4 = File.join(ROOT, "infra/nested/stack-app-sam-4.yaml")
BACKUP = File.join(ROOT, "infra/nested/stack-app-sam.before-primary-split.yaml")

STACK4_ONLY = %w[
  ListBillingPlansFunction
  GetAgencyBillingProfileFunction
  PatchAgencyBillingProfileFunction
  PostBillingSubscriptionChangeFunction
  PostBillingSubscriptionCancelFunction
  ListAgencyBillingInvoicesFunction
  PostAgencyBillingInvoiceFunction
  ListAgencyBillingPaymentMethodsFunction
  PostAgencyBillingPaymentMethodFunction
  PostAgencyBillingPaymentMethodDefaultFunction
  BillingTenantHttpFunction
  AdminInvoicesHttpFunction
  BillingCustomersHttpFunction
  BillingServicesHttpFunction
  BillingInvoicesHttpFunction
  BillingSchedulesHttpFunction
  BillingPaymentsHttpFunction
  TenantAddonsHttpFunction
  AgencyNetworkPolicyHttpFunction
  WafNetworkPolicySyncFunction
  BillingSchedulerFunction
  BillingPaymentsDisabledCatchAllFunction
  RingConnectLoginFunction
  RingConnectCallbackFunction
  RingConnectDevicesFunction
  RingConnectRefreshTokenFunction
  RingConnectAvailableCamerasFunction
  RingConnectRequestCameraAccessFunction
  RingConnectCameraConsentApproveFunction
  RingConnectCameraConsentDeclineFunction
  RingConnectRevokeCameraAccessFunction
  AppManagedPolicyRingConnectSecrets
  AgencyNetworkPolicySyncTopic
].freeze

STACK4_SET = STACK4_ONLY.to_h { |n| [n, true] }.freeze

STACK4_DUP_FROM_STACK1 = %w[
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
  raise "bad Resources: first line was #{lines.first.inspect}" unless lines.first.strip == "Resources:"

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
    idx += 1 while idx < body.size && !body[idx].match(/^  ([A-Za-z0-9]+):\s*$/)
    out << [nm, body[s...idx].map { |l| "#{l}\n" }.join]
  end
  out
end

def patch_stack4_prefix!(text)
  unless text.include?("ImportedCognitoUserPoolId:")
    anchor = "  SnsEmailSubscription:\n"
    abort("splitter: anchor '#{anchor.strip}' not found in prefix") unless text.include?(anchor)

    cognito_params = [
      "  # --- Imported from primary SAM stack (AppSamStackV2); deploy stack 1 first ---\n",
      "  ImportedCognitoUserPoolId:\n",
      "    Type: String\n",
      "    Description: Cognito User Pool ID from AppSamStackV2.\n",
      "  ImportedCognitoWebClientId:\n",
      "    Type: String\n",
      "    Description: Cognito web app client ID from AppSamStackV2.\n",
      "  ImportedCognitoNativeClientId:\n",
      "    Type: String\n",
      "    Default: \"\"\n",
      "    Description: Cognito native client ID (PKCE); optional.\n",
      "  ImportedCognitoIssuer:\n",
      "    Type: String\n",
      "    Description: JWT issuer URL for HttpApi authorizer.\n",
      "\n"
    ].join
    text.sub!(anchor, cognito_params + anchor)
  end

  unless text.include?("Sam4ManagedPolicyNamePrefix:")
    anchor = "  AppName:\n    Type: String\n    Default: rapid-cortex\n    Description: Short prefix for S3, SNS, Cognito names, and default Dynamo table prefix slug.\n"
    abort("splitter: AppName block anchor not found") unless text.include?(anchor)
    sam4_param = [
      "  Sam4ManagedPolicyNamePrefix:\n",
      "    Type: String\n",
      "    Default: \"\"\n",
      "    Description: Parent stack name prefix for IAM managed policies (stack 4).\n",
      "\n"
    ].join
    text.sub!(anchor, anchor + sam4_param)
  end

  text.gsub!(
    "COGNITO_USER_POOL_ID: !Ref CognitoUserPool\n",
    "COGNITO_USER_POOL_ID: !Ref ImportedCognitoUserPoolId\n"
  )
  text.gsub!(
    "COGNITO_CLIENT_ID: !Ref CognitoUserPoolClient\n",
    "COGNITO_CLIENT_ID: !Ref ImportedCognitoWebClientId\n"
  )
  text
end

def patch_stack1_globals!(text)
  text.gsub!(
    '"ans":"${AgencyNetworkPolicySyncTopic}",',
    '"ans":"",'
  )
  text.gsub!(
    "            AgencyNetworkPolicySyncTopic: !Ref AgencyNetworkPolicySyncTopic\n",
    ""
  )
  text
end

def patch_stack4_globals!(text)
  text.gsub!(
    "        CONNECT_BRIDGE_CLUSTER_ARN: !Ref ConnectBridgeClusterArn\n",
    "        CONNECT_BRIDGE_CLUSTER_ARN: \"\"\n"
  )
  text.gsub!(
    "        CONNECT_BRIDGE_TASK_DEFINITION: !Ref ConnectBridgeTaskDefinitionResource\n",
    "        CONNECT_BRIDGE_TASK_DEFINITION: \"\"\n"
  )
  text.gsub!(
    "        VENUE_BRIDGE_CLUSTER_ARN: !If\n          - HasVenueBridgeCluster\n          - !Ref VenueBridgeClusterArn\n          - \"\"\n",
    "        VENUE_BRIDGE_CLUSTER_ARN: \"\"\n"
  )
  text.gsub!(
    "        VENUE_BRIDGE_TASK_DEFINITION: !If\n          - HasVenueBridgeCluster\n          - !Ref VenueBridgeTaskDefinitionResource\n          - \"\"\n",
    "        VENUE_BRIDGE_TASK_DEFINITION: \"\"\n"
  )
  text
end

def disambiguate_stack4_resources!(text)
  {
    "${AppName}-lambda-ddb-crud-${DeploymentStage}-" => "${Sam4ManagedPolicyNamePrefix}-sam4-lambda-ddb-crud-${DeploymentStage}-",
    "${AppName}-lambda-s3-app-${DeploymentStage}" => "${Sam4ManagedPolicyNamePrefix}-sam4-lambda-s3-app-${DeploymentStage}",
    "${AppName}-lambda-bedrock-aiqa-${DeploymentStage}" => "${Sam4ManagedPolicyNamePrefix}-sam4-lambda-bedrock-aiqa-${DeploymentStage}",
    "${AppName}-lambda-bedrock-qaonly-${DeploymentStage}" => "${Sam4ManagedPolicyNamePrefix}-sam4-lambda-bedrock-qaonly-${DeploymentStage}",
    "${AppName}-lambda-sec-ml-scoped-${DeploymentStage}" => "${Sam4ManagedPolicyNamePrefix}-sam4-lambda-sec-ml-scoped-${DeploymentStage}",
    "${AppName}-lambda-sec-analyze-read-${DeploymentStage}" => "${Sam4ManagedPolicyNamePrefix}-sam4-lambda-sec-analyze-read-${DeploymentStage}",
    "${AppName}-lambda-comprehend-translate-${DeploymentStage}" => "${Sam4ManagedPolicyNamePrefix}-sam4-lambda-comprehend-translate-${DeploymentStage}",
    "${AppName}-lambda-ring-secrets-${DeploymentStage}" => "${Sam4ManagedPolicyNamePrefix}-sam4-lambda-ring-secrets-${DeploymentStage}",
    "${AppName}-lambda-sns-ops-${DeploymentStage}" => "${Sam4ManagedPolicyNamePrefix}-sam4-lambda-sns-ops-${DeploymentStage}",
    "${AppName}-lambda-ses-billing-${DeploymentStage}" => "${Sam4ManagedPolicyNamePrefix}-sam4-lambda-ses-billing-${DeploymentStage}",
    "${AppName}-lambda-transcribe-audio-${DeploymentStage}" => "${Sam4ManagedPolicyNamePrefix}-sam4-lambda-transcribe-audio-${DeploymentStage}",
    "${AppName}-lambda-cognito-agadm-${DeploymentStage}" => "${Sam4ManagedPolicyNamePrefix}-sam4-lambda-cognito-agadm-${DeploymentStage}",
    "${AppName}-httpapi-waf-${DeploymentStage}" => "${AppName}-httpapi4-waf-${DeploymentStage}"
  }.each { |from, to| text.gsub!(from, to) }

  %w[ops ops2 ops3 ops4].each do |prev|
    text.gsub!(
      "- !Sub \"${AppName}-#{prev}-${DeploymentStage}-${AWS::AccountId}\"",
      "- !Sub \"${AppName}-ops4-${DeploymentStage}-${AWS::AccountId}\""
    )
  end

  text.gsub!(
    "issuer: !Sub https://cognito-idp.${AWS::Region}.amazonaws.com/${CognitoUserPool}\n              audience:\n                - !Ref CognitoUserPoolClient",
    "issuer: !Ref ImportedCognitoIssuer\n              audience:\n                - !Ref ImportedCognitoWebClientId"
  )
  text.gsub!(
    "                - !Ref CognitoNativeUserPoolClient",
    "                - !Ref ImportedCognitoNativeClientId"
  )
  text.gsub!(
    "Resource: !GetAtt CognitoUserPool.Arn",
    'Resource: !Sub "arn:aws:cognito-idp:${AWS::Region}:${AWS::AccountId}:userpool/${ImportedCognitoUserPoolId}"'
  )
  text.gsub!(
    "COGNITO_USER_POOL_ID: !Ref CognitoUserPool\n",
    "COGNITO_USER_POOL_ID: !Ref ImportedCognitoUserPoolId\n"
  )
  text.gsub!(
    "COGNITO_CLIENT_ID: !Ref CognitoUserPoolClient\n",
    "COGNITO_CLIENT_ID: !Ref ImportedCognitoWebClientId\n"
  )
  text
end

abort("missing #{SRC}") unless File.file?(SRC)

mono = File.read(SRC, encoding: "UTF-8")
r_idx = mono.index(/^Resources:\s*$/) or abort("no Resources section in #{SRC}")
o_idx = mono.index(/^Outputs:\s*$/) or abort("no Outputs section in #{SRC}")

prefix = mono[0...r_idx]
resources_section = mono[r_idx...o_idx]
outputs_and_rest = mono[o_idx..]

spans = resource_spans(resources_section)
by_name = spans.to_h

missing = (STACK4_ONLY + STACK4_DUP_FROM_STACK1).uniq.reject { |n| by_name.key?(n) }
abort("Unknown resource names (not in #{SRC}): #{missing.join(', ')}") if missing.any?

stack1_bodies = []
stack4_bodies = []
dup_bodies = STACK4_DUP_FROM_STACK1.map { |n| by_name.fetch(n) }

spans.each do |name, blob|
  if STACK4_SET[name]
    stack4_bodies << blob
  else
    stack1_bodies << blob
  end
end

stack1_prefix = patch_stack1_globals!(prefix.dup)
stack1_resources = +"Resources:\n#{stack1_bodies.join}"
stack4_prefix = patch_stack4_globals!(patch_stack4_prefix!(prefix.dup))
stack4_resources = disambiguate_stack4_resources!(+"Resources:\n#{dup_bodies.join}#{stack4_bodies.join}")

STACK4_ONLY.each do |name|
  if stack1_resources.match?(/^  #{Regexp.escape(name)}:\s*$/)
    abort("BUG: #{name} still present in stack1_resources after partition")
  end
end

stack4_outputs = <<~YAML

Outputs:
  OpsAlertsTopicArn:
    Description: SNS topic ARN for CloudWatch alarm notifications (stack 4 billing/ring).
    Value: !Ref OpsAlertsTopic
  HttpApiUrl:
    Description: HTTP API base URL (stack 4)
    Value: !GetAtt Api.ApiEndpoint
  HttpApiId:
    Description: HTTP API ID (stack 4)
    Value: !Ref Api
  ApiWebAclArn:
    Condition: HasApiWaf
    Description: Regional WAF web ACL attached to stack 4 HTTP API.
    Value: !GetAtt ApiWebAcl.Arn
  ApiCustomDomainUrl:
    Condition: HasApiCustomDomainCert
    Description: Stack 4 API custom domain URL.
    Value: !Sub "https://${ApiSubdomainPrefix}.${RootDomainName}"
  ApiTlsCertificateArn:
    Condition: HasApiCustomDomainCert
    Description: ACM certificate ARN for stack 4 API custom domain.
    Value: !If [HasImportedApiCert, !Ref ApiDomainCertificateArn, !Ref ApiManagedCertificate]
YAML

FileUtils.cp(SRC, BACKUP) unless File.file?(BACKUP)

File.write(OUT1, stack1_prefix + stack1_resources + outputs_and_rest, encoding: "UTF-8")
File.write(OUT4, stack4_prefix + stack4_resources + stack4_outputs, encoding: "UTF-8")

stack1_count = stack1_bodies.size
stack4_fn = stack4_bodies.size
dup_count = dup_bodies.size

puts "Wrote  #{OUT1}  (#{stack1_count} resources retained in stack 1)"
puts "Wrote  #{OUT4}  (#{dup_count} shared + #{stack4_fn} domain resources)"
puts "Backup #{BACKUP}"
puts ""
s1_bytes = File.size(OUT1)
s4_bytes = File.size(OUT4)
puts "Stack 1 on disk: #{s1_bytes} B (#{(s1_bytes / 1024.0).round(1)} KiB) — target < 200 KiB"
puts "Stack 4 on disk: #{s4_bytes} B (#{(s4_bytes / 1024.0).round(1)} KiB) — target < 200 KiB"
