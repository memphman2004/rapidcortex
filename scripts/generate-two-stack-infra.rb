#!/usr/bin/env ruby
# frozen_string_literal: true

# Regenerates nested infra from infra/template.monolith.before-nested.yaml

require "set"
require "fileutils"

ROOT = File.expand_path("..", __dir__)
SRC = File.join(ROOT, "infra/template.monolith.before-nested.yaml")
abort("missing #{SRC}") unless File.file?(SRC)

MONO = File.read(SRC, encoding: "UTF-8")

def parameter_names_strict(params_slice)
  names = []
  lines = params_slice.lines
  i = 0
  while i < lines.size
    m = lines[i].match(/^  ([A-Za-z0-9]+):\s*$/)
    if m && lines[i + 1].to_s.match(/^    Type:/)
      names << m[1]
    end
    i += 1
  end
  names
end

def refs_in(yaml)
  Set.new(yaml.scan(/!Ref ([A-Za-z0-9]+)/).flatten)
end

p_idx = MONO.index(/^Parameters:\s*$/) or abort("no Parameters")
rules_idx = MONO.index(/^Rules:\s*$/)
c_idx = MONO.index(/^Conditions:\s*$/) or abort("no Conditions")
g_idx = MONO.index(/^Globals:\s*$/) or abort("no Globals")
r_idx = MONO.index(/^Resources:\s*$/) or abort("no Resources")
o_idx = MONO.index(/^Outputs:\s*$/) or abort("no Outputs")

top_prefix = MONO[0...p_idx]
unless rules_idx && rules_idx < c_idx
  abort "expected Rules section between Parameters and Conditions"
end

params_only = MONO[p_idx...rules_idx]
rules_block = MONO[rules_idx...c_idx]
cond_map = MONO[c_idx...g_idx]
resources_section = MONO[r_idx...o_idx]
outputs_block = MONO[o_idx..]

param_names = parameter_names_strict(params_only)

def resource_spans(resources_section)
  lines = resources_section.lines
  raise "bad Resources" unless lines.first.strip == "Resources:"
  body = lines[1..].map(&:chomp)
  out = []
  idx = 0
  while idx < body.size
    # Top-level logical IDs are indented exactly 2 spaces (not Properties nesting).
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

def primary_cloudformation_type(blob)
  lines = blob.lines
  i = 1
  while i < lines.size
    ln = lines[i]
    break if ln.match(/^ {4}Properties:\s*$/)
    m = ln.match(/^ {4}Type:\s+(.+)$/)
    return m[1].strip if m

    i += 1
  end
  nil
end

ordered = resource_spans(resources_section)
types = ordered.to_h { |id, b| [id, primary_cloudformation_type(b)] }
tables = ordered.filter_map { |id, _| id if types[id] == "AWS::DynamoDB::Table" }

data_ids = Set.new(tables) + %w[
  AssetsBucket
  BillingInvoicesBucket
  BillingPosBucket
  BillingPosBucketPolicy
  MultilingualAzureApiKeysSecret
  MultilingualGoogleServiceAccountSecret
  BillingPaymentInstructionsSecret
  BillingSesCredentialsSecret
]

data_resources = +"Resources:\n" + ordered.filter_map { |id, b| "#{b}" if data_ids.include?(id) }.join

app_resources = +"Resources:\n" + ordered.filter_map { |id, b| "#{b}" unless data_ids.include?(id) }.join

# stack-app-sam.yaml lives under infra/nested/: re-base CodeUri relative to repo layout (was infra/).
app_resources.gsub!("CodeUri: ../apps/api/", "CodeUri: ../../apps/api/")
app_resources.gsub!("CodeUri: cognito-post-confirmation/", "CodeUri: ../cognito-post-confirmation/")

tables.each do |tid|
  app_resources.gsub!("!GetAtt #{tid}.Arn",
                      '!Sub arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${' + tid + '}')
end

# Managed secrets provisioned by data-layer stack; Globals already patched above.
app_resources.gsub!("!Ref MultilingualAzureApiKeysSecret", "!Ref NestedMultilingualAzureApiKeysSecretArn")
app_resources.gsub!("!Ref MultilingualGoogleServiceAccountSecret",
                    "!Ref NestedMultilingualGoogleServiceAccountSecretArn")

%w[BillingInvoicesBucket BillingPosBucket].each do |bid|
  # Buckets live in data layer; names are Parameters (no Bucket resource ⇒ no .Arn in !Sub placeholders).
  app_resources.gsub!("!Sub \"${#{bid}.Arn}/*\"", "!Sub \"arn:aws:s3:::${#{bid}}/*\"")
end
app_resources.gsub!(
  '!Sub "${BillingPosBucket.Arn}/*.pdf"',
  '!Sub "arn:aws:s3:::${BillingPosBucket}/*.pdf"'
)

globals_patched =
  (MONO[g_idx...r_idx]).dup
    .gsub("BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN: !Ref BillingPaymentInstructionsSecret",
          "BILLING_PAYMENT_INSTRUCTIONS_SECRET_ARN: !Ref BillingPaymentInstructionsSecretArn")
    .gsub("BILLING_SES_CREDENTIALS_SECRET_ARN: !Ref BillingSesCredentialsSecret",
          "BILLING_SES_CREDENTIALS_SECRET_ARN: !Ref BillingSesCredentialsSecretArn")
    .gsub("!Ref MultilingualAzureApiKeysSecret", "!Ref NestedMultilingualAzureApiKeysSecretArn")
    .gsub("!Ref MultilingualGoogleServiceAccountSecret", "!Ref NestedMultilingualGoogleServiceAccountSecretArn")

cross_params = +""
tables.each do |tid|
  cross_params << <<~YAML
    #{tid}:
      Type: String
      Description: Physical DynamoDB table name from data layer (#{tid}).
  YAML
end
cross_params << <<~YAML
  AssetsBucket:
    Type: String
    Description: Assets bucket name from data layer.
  BillingInvoicesBucket:
    Type: String
    Description: Billing invoices bucket name from data layer.
  BillingPosBucket:
    Type: String
    Description: Billing POS bucket name from data layer.
  NestedMultilingualAzureApiKeysSecretArn:
    Type: String
    Default: ""
    Description: Managed multilingual Azure secret ARN from data layer (may be empty).
  NestedMultilingualGoogleServiceAccountSecretArn:
    Type: String
    Default: ""
    Description: Managed multilingual Google secret ARN from data layer (may be empty).
  BillingPaymentInstructionsSecretArn:
    Type: String
    Description: Billing payment instructions secret ARN from data layer.
  BillingSesCredentialsSecretArn:
    Type: String
    Description: Billing SES credentials secret ARN from data layer.
YAML

def indent_yaml_fragment(fragment, cols)
  pad = " " * cols
  fragment.each_line.map { |ln| ln.strip.empty? ? ln : "#{pad}#{ln}" }.join
end

# cross_params heredocs strip minimum indent → keys land at column 0; Parameters requires 2-space indent.
cross_params_under_parameters = indent_yaml_fragment(cross_params, 2)

data_header = top_prefix.lines.reject { |l| l.match?(/^Transform:\s+AWS::Serverless-2016-10-31\s*$/) }.join

outputs_body =
  tables.map do |tid|
    <<~YAML
      #{tid}:
        Description: Physical table name for #{tid}
        Value: !Ref #{tid}
    YAML
  end.join +
    %w[AssetsBucket BillingInvoicesBucket BillingPosBucket].map do |bid|
      <<~YAML
        #{bid}:
          Description: Physical bucket name for #{bid}
          Value: !Ref #{bid}
      YAML
    end.join +
    <<~YAML
      MultilingualAzureApiKeysSecretArn:
        Description: Managed Azure keys secret ARN (empty when not provisioned)
        Value: !If [UseManagedMultilingualSecrets, !Ref MultilingualAzureApiKeysSecret, ""]
      MultilingualGoogleServiceAccountSecretArn:
        Description: Managed Google SA secret ARN (empty when not provisioned)
        Value: !If [UseManagedMultilingualSecrets, !Ref MultilingualGoogleServiceAccountSecret, ""]
      BillingPaymentInstructionsSecretArn:
        Description: Billing payment instructions secret ARN
        Value: !Ref BillingPaymentInstructionsSecret
      BillingSesCredentialsSecretArn:
        Description: Billing SES credentials secret ARN
        Value: !Ref BillingSesCredentialsSecret
    YAML

data_yaml =
  data_header +
  params_only +
  rules_block +
  cond_map +
  data_resources +
  "\nOutputs:\n" +
  indent_yaml_fragment(outputs_body, 2)

# Data stack carries forwarded parameters + Conditions for parity; many Conditions are consumed only indirectly.
data_yaml = data_yaml.sub(
  "ignore_checks:\n        - W1028\n",
  "ignore_checks:\n        - W1028\n        - W2001\n        - W7001\n        - W8001\n",
)

outputs_patched =
  outputs_block.dup
                 .gsub(/Value:\s+!Ref MultilingualAzureApiKeysSecret\s*$/, "Value: !Ref NestedMultilingualAzureApiKeysSecretArn")
                 .gsub(/Value:\s+!Ref MultilingualGoogleServiceAccountSecret\s*$/, "Value: !Ref NestedMultilingualGoogleServiceAccountSecretArn")

app_yaml =
  top_prefix +
  params_only.rstrip + "\n" + cross_params_under_parameters + "\n" +
  rules_block +
  cond_map +
  globals_patched +
  app_resources +
  outputs_patched

# DynamoDB tables moved to data layer: Conditions/Mappings referencing PITR/prefix remain for doc parity but are unused here.
app_yaml = app_yaml.sub(
  "ignore_checks:\n        - W1028\n",
  "ignore_checks:\n        - W1028\n        - W8001\n        - W7001\n",
)

def yaml_kv_lines(hsh, indent)
  hsh.reject { |k, _| k.nil? }.sort_by { |k, _| k }.map { |k, v| "#{indent}#{k}: #{v}" }.join("\n") + "\n"
end

data_prop = {}
(data_needs = refs_in(data_yaml) & Set.new(param_names)).each do |n|
  data_prop[n] = "!Ref #{n}"
end

cross_injections = {}
tables.each { |t| cross_injections[t] = "!GetAtt DataLayerStack.Outputs.#{t}" }
%w[AssetsBucket BillingInvoicesBucket BillingPosBucket].each do |b|
  cross_injections[b] = "!GetAtt DataLayerStack.Outputs.#{b}"
end
cross_injections["NestedMultilingualAzureApiKeysSecretArn"] =
  "!GetAtt DataLayerStack.Outputs.MultilingualAzureApiKeysSecretArn"
cross_injections["NestedMultilingualGoogleServiceAccountSecretArn"] =
  "!GetAtt DataLayerStack.Outputs.MultilingualGoogleServiceAccountSecretArn"
cross_injections["BillingPaymentInstructionsSecretArn"] =
  "!GetAtt DataLayerStack.Outputs.BillingPaymentInstructionsSecretArn"
cross_injections["BillingSesCredentialsSecretArn"] =
  "!GetAtt DataLayerStack.Outputs.BillingSesCredentialsSecretArn"

app_prop = {}
param_names.each { |n| app_prop[n] = "!Ref #{n}" }
cross_injections.each { |k, v| app_prop[k] = v }

data_yaml_params = yaml_kv_lines(data_prop, "        ")
app_yaml_params = yaml_kv_lines(app_prop, "        ")

root_desc = <<~YAML
  AWSTemplateFormatVersion: "2010-09-09"
  Metadata:
    cfn-lint:
      config:
        ignore_checks:
          - W3002
  Description: >-
    Rapid Cortex nested root stack. Delegates DynamoDB/S3/multilingual billing secrets to stack-data-layer
    and SAM runtime to stack-app-sam. Regenerate via scripts/generate-two-stack-infra.rb.
YAML

part_res =
  "Resources:\n" \
  "  DataLayerStack:\n" \
  "    Type: AWS::CloudFormation::Stack\n" \
  "    Properties:\n" \
  "      TimeoutInMinutes: 120\n" \
  "      TemplateURL: nested/stack-data-layer.yaml\n" \
  "      Parameters:\n"
part_appstk =
  "  AppSamStack:\n" \
  "    Type: AWS::CloudFormation::Stack\n" \
  "    Properties:\n" \
  "      TimeoutInMinutes: 180\n" \
  "      TemplateURL: nested/stack-app-sam.yaml\n" \
  "      Parameters:\n"
outs = <<~YAML
  Outputs:
    HttpApiUrl:
      Description: HTTP API base URL
      Value: !GetAtt AppSamStack.Outputs.HttpApiUrl
    UserPoolId:
      Description: Cognito user pool id
      Value: !GetAtt AppSamStack.Outputs.UserPoolId
    UserPoolClientId:
      Description: Cognito web client id
      Value: !GetAtt AppSamStack.Outputs.UserPoolClientId
    NativeUserPoolClientId:
      Description: Cognito native client id
      Value: !GetAtt AppSamStack.Outputs.NativeUserPoolClientId
    AssetsBucketName:
      Description: Assets bucket (from data layer)
      Value: !GetAtt DataLayerStack.Outputs.AssetsBucket
    ApiCustomDomainUrl:
      Description: API custom domain URL if configured
      Value: !GetAtt AppSamStack.Outputs.ApiCustomDomainUrl
    CognitoIssuer:
      Description: Cognito issuer URL
      Value: !GetAtt AppSamStack.Outputs.CognitoIssuer
    CognitoHostedUiBase:
      Description: Cognito hosted UI base
      Value: !GetAtt AppSamStack.Outputs.CognitoHostedUiBase
    ApiWebAclArn:
      Description: Regional WAF ACL ARN (if enabled)
      Value: !GetAtt AppSamStack.Outputs.ApiWebAclArn
    DeploymentStage:
      Description: Deployment stage
      Value: !Ref DeploymentStage
YAML

root_yaml =
  root_desc +
  params_only +
  rules_block +
  part_res +
  data_yaml_params +
  part_appstk +
  app_yaml_params +
  outs

FileUtils.mkdir_p(File.join(ROOT, "infra/nested"))
File.write(File.join(ROOT, "infra/template.yaml"), root_yaml)
File.write(File.join(ROOT, "infra/nested/stack-data-layer.yaml"), data_yaml)
File.write(File.join(ROOT, "infra/nested/stack-app-sam.yaml"), app_yaml)

warn "Wrote infra/template.yaml, infra/nested/stack-data-layer.yaml, infra/nested/stack-app-sam.yaml"
warn "Data stack parameter wiring: #{data_prop.size}; AppSam parameter wiring: #{app_prop.size}"
