#!/usr/bin/env ruby
# frozen_string_literal: true

# split-stack-app-sam-primary-v2.rb
#
# Partitions infra/nested/stack-app-sam.yaml (AppSamStackV2) further:
#   stack-app-sam.yaml    (retained: incidents, CAD, QA, users, agencies — ~46 functions)
#   stack-app-sam-5.yaml  (new: campus, venue intelligence, stream/bridge, media, live video)
#
# WHY
#   stack-app-sam.yaml is 224 KB after the billing/ring split (split-stack-app-sam-primary.rb).
#   At 5–7× SAM expansion that's 1.12–1.57 MB — over CloudFormation's 1 MB transform limit.
#   Removing 24 more functions → ~145 KB remaining → ~725 KB expanded → under limit.
#
# STACK 5 DOMAINS (24 functions)
#   Campus vertical (9)     — campus incident CRUD, buildings, analytics, public report
#   Venue intelligence (4)  — venue/incident intel, camera request, SMS inbound
#   Stream / Bridge (3)     — stream viewer token, session status, bridge health
#   Media (2)               — incident media HTTP (admin + public)
#   Live video / Silent     — live video, silent text, pinpoint HTTP (6)
#     text / Pinpoint
#
# STACK 1 RETAINS (~46 functions)
#   Incidents (core CRUD, transcript, analysis, triage, SOP, shares, legal hold)
#   CAD (admin, writeback, webhook, worker, poller)
#   QA / SEO / Deception
#   Admin users + auth
#   Agencies + invites
#   Cognito post-confirm, health
#
# Usage: ruby scripts/split-stack-app-sam-primary-v2.rb
#
# After running:
#   1. Add AppSam5Stack to infra/template.yaml (same pattern as AppSam4Stack)
#   2. bash scripts/deploy.sh dev

require "fileutils"

ROOT   = File.expand_path("..", __dir__)
SRC    = File.join(ROOT, "infra/nested/stack-app-sam.yaml")
OUT1   = File.join(ROOT, "infra/nested/stack-app-sam.yaml")
OUT5   = File.join(ROOT, "infra/nested/stack-app-sam-5.yaml")
BACKUP = File.join(ROOT, "infra/nested/stack-app-sam.before-v2-split.yaml")

# ── Functions moved exclusively to Stack 5 ───────────────────────────────────

STACK5_ONLY = %w[
  GetCampusIncidentsFunction
  PostCampusIncidentFunction
  GetCampusIncidentFunction
  PatchCampusIncidentFunction
  PostCampusIncidentNoteFunction
  PostCampusIncidentEscalateFunction
  GetCampusBuildingsFunction
  GetCampusAnalyticsFunction
  PostCampusPublicReportFunction
  GetIncidentVenueIntelligenceFunction
  GetVenueIntelligenceFunction
  VenueCameraRequestFunction
  VenueSmsInboundFunction
  StreamViewerTokenFunction
  StreamSessionStatusFunction
  BridgeHealthMonitorFunction
  IncidentMediaHttpFunction
  PublicIncidentMediaHttpFunction
  LiveVideoIncidentsHttpFunction
  LiveVideoPublicHttpFunction
  SilentTextIncidentsHttpFunction
  SilentTextPublicHttpFunction
  PinpointIncidentsHttpFunction
  PinpointPublicHttpFunction
].freeze

# Non-Lambda resources that travel with the above functions.
# Add only if they exist in the template — the abort check will surface mismatches.
STACK5_COMPANION_RESOURCES = %w[
  ConnectBridgeEcrRepository
  VenueBridgeEcrRepository
  BridgeTaskExecutionRole
  BridgeTaskRole
  ConnectBridgeLogGroup
  VenueBridgeLogGroup
  ConnectBridgeTaskDefinitionResource
  VenueBridgeTaskDefinitionResource
  LiveVideoIncidentsHttpLogGroup
  LiveVideoIncidentsHttpErrorsAlarm
  LiveVideoPublicHttpErrorsAlarm
  LiveVideoSmsRoutingFailedMetricFilter
  IncidentMediaHttpLogGroup
  IncidentMediaSmsRoutingFailedMetricFilter
  ConnectViewerChannelPolicy
  KvsWebRtcBrowserTokenRole
].freeze

STACK5_SET = (STACK5_ONLY + STACK5_COMPANION_RESOURCES).to_h { |n| [n, true] }.freeze

# ── Shared resources duplicated into Stack 5 (same pattern as Stack 4) ────────

STACK5_DUP_FROM_STACK1 = %w[
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

# ── Resource span parser ──────────────────────────────────────────────────────

def resource_spans(resources_section)
  lines = resources_section.lines
  raise "unexpected first line: #{lines.first.inspect}" unless lines.first.strip == "Resources:"

  body = lines[1..].map(&:chomp)
  out  = []
  idx  = 0
  while idx < body.size
    m = body[idx].match(/^  ([A-Za-z0-9]+):\s*$/)
    unless m
      idx += 1
      next
    end
    nm  = m[1]
    s   = idx
    idx += 1
    idx += 1 while idx < body.size && !body[idx].match(/^  ([A-Za-z0-9]+):\s*$/)
    out << [nm, body[s...idx].map { |l| "#{l}\n" }.join]
  end
  out
end

# ── Load + parse ──────────────────────────────────────────────────────────────

abort("missing #{SRC}") unless File.file?(SRC)

mono   = File.read(SRC, encoding: "UTF-8")
r_idx  = mono.index(/^Resources:\s*$/) or abort("no Resources: section")
o_idx  = mono.index(/^Outputs:\s*$/)   or abort("no Outputs: section")

prefix            = mono[0...r_idx]
resources_section = mono[r_idx...o_idx]
outputs_and_rest  = mono[o_idx..]

spans   = resource_spans(resources_section)
by_name = spans.to_h

# Resolve companion resources — skip silently if not present in this template
# (they may already be in a different nested stack from a prior split)
companion_in_template = STACK5_COMPANION_RESOURCES.select { |n| by_name.key?(n) }
companion_missing     = STACK5_COMPANION_RESOURCES.reject { |n| by_name.key?(n) }
companion_missing.each { |n| puts "  (companion #{n} not in template — skipping)" }

required = STACK5_ONLY + STACK5_DUP_FROM_STACK1
missing  = required.reject { |n| by_name.key?(n) }
abort("Unknown resource names: #{missing.join(", ")}") if missing.any?

effective_set = (STACK5_ONLY + companion_in_template).to_h { |n| [n, true] }

# ── Partition ─────────────────────────────────────────────────────────────────

stack1_bodies = []
stack5_bodies = []
dup_bodies    = STACK5_DUP_FROM_STACK1.map { |n| by_name.fetch(n) }

spans.each do |name, blob|
  if effective_set[name]
    stack5_bodies << blob
  else
    stack1_bodies << blob
  end
end

stack1_resources = +"Resources:\n#{stack1_bodies.join}"
stack5_resources = +"Resources:\n#{dup_bodies.join}#{stack5_bodies.join}"

# ── Stack 5 prefix: inherit from Stack 1 (Cognito + Globals already correct) ──

stack5_prefix = prefix.dup

stack5_imported_cognito = [
  "  # --- Imported from primary SAM stack (AppSamStackV2); deploy stack 1 first ---",
  "  ImportedCognitoUserPoolId:",
  "    Type: String",
  "    Description: Cognito User Pool ID from AppSamStackV2.",
  "  ImportedCognitoWebClientId:",
  "    Type: String",
  "    Description: Cognito web app client ID from AppSamStackV2.",
  "  ImportedCognitoNativeClientId:",
  "    Type: String",
  "    Default: \"\"",
  "    Description: Cognito native client ID (PKCE); optional.",
  "  ImportedCognitoIssuer:",
  "    Type: String",
  "    Description: JWT issuer URL for HttpApi authorizer.",
  "",
].join("\n")
stack5_prefix.sub!("  SnsEmailSubscription:", "#{stack5_imported_cognito}  SnsEmailSubscription:")

# Disambiguate physical names for Stack 5
{
  "${AppName}-lambda-ddb-crud-${DeploymentStage}-"        => "${AppName}-sam5-lambda-ddb-crud-${DeploymentStage}-",
  "${AppName}-lambda-s3-app-${DeploymentStage}"           => "${AppName}-sam5-lambda-s3-app-${DeploymentStage}",
  "${AppName}-lambda-bedrock-aiqa-${DeploymentStage}"     => "${AppName}-sam5-lambda-bedrock-aiqa-${DeploymentStage}",
  "${AppName}-lambda-bedrock-qaonly-${DeploymentStage}"   => "${AppName}-sam5-lambda-bedrock-qaonly-${DeploymentStage}",
  "${AppName}-lambda-sec-ml-scoped-${DeploymentStage}"    => "${AppName}-sam5-lambda-sec-ml-scoped-${DeploymentStage}",
  "${AppName}-lambda-sec-analyze-read-${DeploymentStage}" => "${AppName}-sam5-lambda-sec-analyze-read-${DeploymentStage}",
  "${AppName}-lambda-comprehend-translate-${DeploymentStage}" => "${AppName}-sam5-lambda-comprehend-translate-${DeploymentStage}",
  "${AppName}-lambda-ops-sns-${DeploymentStage}"          => "${AppName}-sam5-lambda-ops-sns-${DeploymentStage}",
  "${AppName}-lambda-ses-billing-${DeploymentStage}"      => "${AppName}-sam5-lambda-ses-billing-${DeploymentStage}",
  "${AppName}-lambda-transcribe-audio-${DeploymentStage}" => "${AppName}-sam5-lambda-transcribe-audio-${DeploymentStage}",
  "${AppName}-lambda-cognito-agadm-${DeploymentStage}"    => "${AppName}-sam5-lambda-cognito-agadm-${DeploymentStage}",
}.each { |from, to| stack5_resources.gsub!(from, to) }

# SNS topic name
%w[ops ops2 ops3 ops4].each do |prev|
  stack5_resources.gsub!(
    "- !Sub \"${AppName}-#{prev}-${DeploymentStage}-${AWS::AccountId}\"",
    "- !Sub \"${AppName}-ops5-${DeploymentStage}-${AWS::AccountId}\""
  )
end

# WAF ACL name
%w[httpapi httpapi2 httpapi3 httpapi4].each do |prev|
  stack5_resources.gsub!("${AppName}-#{prev}-waf-${DeploymentStage}",
                          "${AppName}-httpapi5-waf-${DeploymentStage}")
end

# ── Validate ──────────────────────────────────────────────────────────────────

effective_set.each_key do |name|
  if stack1_resources.match?(/^  #{Regexp.escape(name)}:\s*$/)
    abort("BUG: #{name} still present in stack1_resources after partition")
  end
end

# ── Stack 5 outputs ───────────────────────────────────────────────────────────

stack5_outputs = <<~YAML

Outputs:
  OpsAlertsTopicArn:
    Description: SNS topic ARN (stack 5 campus/venue/media).
    Value: !Ref OpsAlertsTopic
  HttpApiUrl:
    Description: HTTP API base URL (stack 5)
    Value: !GetAtt Api.ApiEndpoint
  HttpApiId:
    Description: HTTP API ID (stack 5)
    Value: !Ref Api
  ApiWebAclArn:
    Condition: HasApiWaf
    Description: WAF web ACL ARN (stack 5).
    Value: !GetAtt ApiWebAcl.Arn
  ApiCustomDomainUrl:
    Condition: HasApiCustomDomainCert
    Description: Stack 5 API custom domain URL.
    Value: !Sub "https://${ApiSubdomainPrefix}.${RootDomainName}"
  ApiTlsCertificateArn:
    Condition: HasApiCustomDomainCert
    Description: ACM certificate ARN (stack 5).
    Value: !If [HasImportedApiCert, !Ref ApiDomainCertificateArn, !Ref ApiManagedCertificate]
YAML

# Stack 1 keeps bridge env as string parameters (bridge ECS lives in Stack 5).
stack1_prefix = prefix.dup

# Stack 1 no longer hosts campus/venue/stream/media Lambdas — drop heavy globals to stay under Lambda's 4KB env limit.
stack1_prefix.gsub!(
  /        RING_CREDENTIALS_SECRET_ARN: !Ref RingCredentialsSecretArn\n        RING_PARTNER_TOKEN_SECRET_ARN: !Ref RingCredentialsSecretArn\n        RING_PARTNERSHIP_ENABLED: !Ref RingPartnershipEnabled\n        RING_API_BASE_URL: !Ref RingApiBaseUrl\n        ENABLE_CONNECT_RING: !Ref EnableConnectRing\n        ENABLE_CONNECT_RING_AVAILABLE_CAMERAS: !If \[PilotTestFeaturesOn, "true", !Ref EnableConnectRingAvailableCameras\]\n        ENABLE_CONNECT_RING_EMERGENCY_REQUESTS: !If \[PilotTestFeaturesOn, "true", !Ref EnableConnectRingEmergencyRequests\]\n        CONNECT_SESSIONS_TABLE: !Ref ConnectAccessSessionsTable\n        VENUE_CAMERA_SESSIONS_TABLE: !Ref ConnectAccessSessionsTable\n        VENUE_FACILITIES_TABLE: !Ref VenueFacilitiesTable\n        VENUE_ASSETS_TABLE: !Ref VenueAssetsTable\n        VENUE_OVERLAYS_TABLE: !Ref VenueIncidentOverlaysTable\n        VENUE_CAMERA_ACCESS_LOG_TABLE: !If\n          - HasVenueCameraAccessLogTable\n          - !Ref VenueCameraAccessLogTable\n          - ""\n        VENUE_CONFIG_TABLE: !If\n          - HasVenueConfigTable\n          - !Ref VenueConfigTable\n          - ""\n        VENUE_CODES: !Sub "\$\{AppName\}-venue-codes"\n        CAMPUS_INCIDENTS_TABLE: !If\n          - HasCampusIncidentsTable\n          - !Ref CampusIncidentsTable\n          - ""\n        CAMPUS_CONFIG_TABLE: !If\n          - HasCampusConfigTable\n          - !Ref CampusConfigTable\n          - ""\n        QR_LOCATIONS_TABLE: !If\n          - HasQRLocationsTable\n          - !Ref QRLocationsTable\n          - ""\n        CAMPUS_CODES: !Sub "\$\{AppName\}-campus-codes"\n        CONNECT_BRIDGE_CLUSTER_ARN: !Ref ConnectBridgeClusterArn\n        VENUE_BRIDGE_CLUSTER_ARN: !If\n          - HasVenueBridgeCluster\n          - !Ref VenueBridgeClusterArn\n          - ""\n        CONNECT_BRIDGE_TASK_DEFINITION: !Ref ConnectBridgeTaskDefinitionResource\n        VENUE_BRIDGE_TASK_DEFINITION: !If\n          - HasVenueBridgeCluster\n          - !Ref VenueBridgeTaskDefinitionResource\n          - ""\n        BRIDGE_SUBNET_IDS: !Ref BridgeSubnetIds\n        BRIDGE_SECURITY_GROUP_IDS: !Ref BridgeSecurityGroupIds\n/m,
  "",
)

stack1_body = stack1_prefix + stack1_resources
stack1_body.gsub!(
  "          COGNITO_USER_POOL_ID: !Ref CognitoUserPool\n          COGNITO_CLIENT_ID: !Ref CognitoUserPoolClient\n          CAD_INTEGRATIONS_TABLE:",
  "          CAD_INTEGRATIONS_TABLE:",
)
stack1_body.gsub!(
  "          COGNITO_USER_POOL_ID: !Ref CognitoUserPool\n          COGNITO_CLIENT_ID: !Ref CognitoUserPoolClient\n          CAD_INTEGRATIONS_TABLE: !Ref CadIntegrationsTable\n          CAD_WEBHOOK_INGRESS_TOPIC_ARN:",
  "          CAD_INTEGRATIONS_TABLE: !Ref CadIntegrationsTable\n          CAD_WEBHOOK_INGRESS_TOPIC_ARN:",
)
stack1_body.gsub!(
  "          COGNITO_USER_POOL_ID: !Ref CognitoUserPool\n          COGNITO_CLIENT_ID: !Ref CognitoUserPoolClient\n      CodeUri: ../../apps/api/\n      Handler: dist/handlers/integrationStatus.handler",
  [
    "          COGNITO_USER_POOL_ID: !Ref CognitoUserPool",
    "          COGNITO_CLIENT_ID: !Ref CognitoUserPoolClient",
    "          RING_CREDENTIALS_SECRET_ARN: !Ref RingCredentialsSecretArn",
    "          RING_PARTNERSHIP_ENABLED: !Ref RingPartnershipEnabled",
    "          ENABLE_CONNECT_RING: !Ref EnableConnectRing",
    "          CONNECT_SESSIONS_TABLE: !Ref ConnectAccessSessionsTable",
    "      CodeUri: ../../apps/api/",
    "      Handler: dist/handlers/integrationStatus.handler",
  ].join("\n"),
)

# Remove stack1 outputs that reference functions moved to Stack 5
stack1_outputs = outputs_and_rest
STACK5_ONLY.each do |fn|
  stack1_outputs = stack1_outputs.gsub(
    /^  \S*#{Regexp.escape(fn)}\S*:\n    Value: !Ref #{Regexp.escape(fn)}\n/,
    "",
  )
end

stack5_body = stack5_prefix + stack5_resources
stack5_body.gsub!(
  "issuer: !Sub https://cognito-idp.${AWS::Region}.amazonaws.com/${CognitoUserPool}",
  "issuer: !Ref ImportedCognitoIssuer",
)
stack5_body.gsub!(
  "                - !Ref CognitoUserPoolClient\n                - !Ref CognitoNativeUserPoolClient",
  "                - !Ref ImportedCognitoWebClientId\n                - !Ref ImportedCognitoNativeClientId",
)
stack5_body.gsub!("COGNITO_USER_POOL_ID: !Ref CognitoUserPool", "COGNITO_USER_POOL_ID: !Ref ImportedCognitoUserPoolId")
stack5_body.gsub!("COGNITO_CLIENT_ID: !Ref CognitoUserPoolClient", "COGNITO_CLIENT_ID: !Ref ImportedCognitoWebClientId")

# ── Write ─────────────────────────────────────────────────────────────────────

FileUtils.cp(SRC, BACKUP) unless File.file?(BACKUP)

File.write(OUT1, stack1_body + stack1_outputs, encoding: "UTF-8")
File.write(OUT5, stack5_body + stack5_outputs, encoding: "UTF-8")

s1_bytes = File.size(OUT1)
s5_bytes = File.size(OUT5)

puts ""
puts "Stack 1  #{OUT1}"
puts "  #{stack1_bodies.size} domain resources retained"
puts "  #{s1_bytes} B (#{(s1_bytes / 1024.0).round(1)} KiB) — target < 200 KiB"
puts "  SAM expansion estimate: #{(s1_bytes * 5 / 1_000_000.0).round(2)}–#{(s1_bytes * 7 / 1_000_000.0).round(2)} MB"
puts ""
puts "Stack 5  #{OUT5}"
puts "  #{dup_bodies.size} shared + #{stack5_bodies.size} domain resources"
puts "  #{s5_bytes} B (#{(s5_bytes / 1024.0).round(1)} KiB)"
puts ""
puts "Backup   #{BACKUP}"
puts ""

if s1_bytes > 200_000
  puts "WARNING: Stack 1 is still over 200 KiB. SAM transform may still fail."
  puts "  Consider moving CAD or QA functions to Stack 5 or a new Stack 6."
else
  puts "Stack 1 within size proxy — deploy should pass SAM transform."
end

puts ""
puts "Next steps:"
puts "  1. Add AppSam5Stack to infra/template.yaml"
puts "     Copy AppSam4Stack block, change:"
puts "       LogicalId:         AppSam5Stack"
puts "       Template:          nested/stack-app-sam-5.yaml"
puts "       ApiSubdomainPrefix: api5"
puts "       (all other params identical to AppSam4Stack)"
puts "  2. source scripts/env-api-dev.sh && SKIP_APP_SAM_SIZE_PROXY=1 bash scripts/deploy.sh dev"
