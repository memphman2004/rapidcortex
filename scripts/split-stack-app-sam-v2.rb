#!/usr/bin/env ruby
# frozen_string_literal: true

# Partitions infra/nested/stack-app-sam-2.yaml into:
#   stack-app-sam-2.yaml  (retained: language/comms, wellness, analytics, retention, demo)
#   stack-app-sam-3.yaml  (new: media/video, agency-admin, RC-admin/desktop)
#
# Mirrors scripts/split-stack-app-sam.rb. Stack 3 duplicates shared IAM + HttpApi with
# sam3 / httpapi3 disambiguation in physical names.
#
# Usage: ruby scripts/split-stack-app-sam-v2.rb

require "fileutils"

ROOT = File.expand_path("..", __dir__)
SRC = File.join(ROOT, "infra/nested/stack-app-sam-2.yaml")
OUT2 = File.join(ROOT, "infra/nested/stack-app-sam-2.yaml")
OUT3 = File.join(ROOT, "infra/nested/stack-app-sam-3.yaml")
BACKUP = File.join(ROOT, "infra/nested/stack-app-sam-2.before-v2-split.yaml")

STACK3_ONLY = %w[
  VideoAssistIncidentsHttpFunction
  VideoAssistPublicHttpFunction
  LiveVideoSmsRoutingFailedMetricFilter
  KvsWebRtcBrowserTokenRole
  LiveVideoIncidentsHttpLogGroup
  LiveVideoIncidentsHttpFunction
  LiveVideoPublicHttpFunction
  LiveVideoIncidentsHttpErrorsAlarm
  LiveVideoPublicHttpErrorsAlarm
  PostAgencySharePartnerFunction
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
  AppManagedPolicyCognitoAgencyAdminUserPoolReads
  RcAdminListApiClientsFunction
  GetDesktopReleasesOverviewFunction
  PostDesktopReleaseSignedUrlFunction
  PostContactSalesLeadFunction
  GetPlatformSummaryFunction
  GetPlatformAuditEventsFunction
].freeze

STACK3_SET = STACK3_ONLY.to_h { |n| [n, true] }.freeze

STACK3_DUP_FROM_STACK2 = %w[
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

def disambiguate_stack3!(text)
  text
    .gsub("Sam2ManagedPolicyNamePrefix", "Sam3ManagedPolicyNamePrefix")
    .gsub("-sam2-", "-sam3-")
    .gsub("httpapi2", "httpapi3")
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

missing = (STACK3_ONLY + STACK3_DUP_FROM_STACK2).uniq.reject { |n| by_name.key?(n) }
abort("Unknown resource names (not in #{SRC}): #{missing.join(', ')}") if missing.any?

stack2_bodies = []
stack3_bodies = []
dup_bodies = STACK3_DUP_FROM_STACK2.map { |n| by_name.fetch(n) }

spans.each do |name, blob|
  if STACK3_SET[name]
    stack3_bodies << blob
  else
    stack2_bodies << blob
  end
end

stack2_resources = +"Resources:\n#{stack2_bodies.join}"
stack3_resources = +"Resources:\n#{dup_bodies.join}#{stack3_bodies.join}"

stack3_prefix = disambiguate_stack3!(prefix.dup)
stack3_resources = disambiguate_stack3!(stack3_resources)

stack3_outputs = <<~YAML

Outputs:
  OpsAlertsTopicArn:
    Description: SNS topic ARN for CloudWatch alarm notifications (stack 3 ops).
    Value: !Ref OpsAlertsTopic
  HttpApiUrl:
    Description: HTTP API base URL (stack 3)
    Value: !GetAtt Api.ApiEndpoint
  HttpApiId:
    Description: HTTP API ID (stack 3)
    Value: !Ref Api
  ApiWebAclArn:
    Description: Regional WAF web ACL attached to stack 3 HTTP API.
    Value: !If [HasApiWaf, !GetAtt ApiWebAcl.Arn, ""]
  ApiCustomDomainUrl:
    Description: Stack 3 API custom domain URL.
    Value: !If [UseApiCustomDomain, !Sub "https://${ApiSubdomainPrefix}.${RootDomainName}", ""]
  ApiTlsCertificateArn:
    Description: ACM certificate ARN for stack 3 API custom domain.
    Value: !If [UseApiCustomDomain, !If [HasImportedApiCert, !Ref ApiDomainCertificateArn, !Ref ApiManagedCertificate], ""]
YAML

STACK3_ONLY.each do |name|
  if stack2_resources.match?(/^  #{Regexp.escape(name)}:\s*$/)
    abort("BUG: #{name} still present in stack2_resources after partition")
  end
end

FileUtils.cp(SRC, BACKUP) unless File.file?(BACKUP)

File.write(OUT2, prefix + stack2_resources + outputs_and_rest, encoding: "UTF-8")
File.write(OUT3, stack3_prefix + stack3_resources + stack3_outputs, encoding: "UTF-8")

puts "Wrote #{OUT2}  (#{stack2_bodies.size} resources retained)"
puts "Wrote #{OUT3}  (#{dup_bodies.size} shared duplicated + #{stack3_bodies.size} domain resources)"
puts "Backup: #{BACKUP}"
