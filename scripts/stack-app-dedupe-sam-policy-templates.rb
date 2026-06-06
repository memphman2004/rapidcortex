#!/usr/bin/env ruby
# frozen_string_literal: true

# SAFELY replaces SAM DynamoDB*/S3* policy-templates on AWS::Serverless::Function ONLY:
# removes those template lines (two-line YAML entries) and prepends references to shared
# AWS::IAM::ManagedPolicies (three Dynamo shards + one S3 app-bucket policy).
# All inline Statement / Fn::If policies are preserved byte-for-byte.
#
# Requires: infra/nested/stack-app-sam.yaml (regenerated from template.monolith or equivalent).

ROOT = File.expand_path("..", __dir__)
PATH = File.join(ROOT, "infra/nested/stack-app-sam.yaml")

TABLE_REFS = %w[
  AccessOverridesTable AgenciesTable AgencySharePartnersTable AgencySubscriptionsTable AnalysesTable
  ApiClientsTable AuditTable BillingAuditEventsTable BillingAuditLogTable BillingProfilesTable
  BillingSchedulesTable BillingWebhookEventsTable CustomersTable DataDeletionAuditTable
  DispatcherCoachingNotesTable ExternalApiRateLimitsTable IncidentMediaTable IncidentSharesTable
  IncidentsTable InvoiceItemsTable InvoicesTable InvitesTable LanguageSessionsTable
  LiveVideoSessionsTable MonetizationAddOnsTable MonetizationInvoicesTable MonetizationPlansTable
  PaymentRecordsTable PremiseNotesTable QASessionsTable QATemplatesTable RcLiteApiKeysTable
  RcLiteRateLimitTable RcLiteUsageTable SalesLeadsTable ServiceCatalogTable SilentTextSessionsTable
  TraumaFlagsTable TranscriptsTable UsageMetersTable VideoAssistSessionsTable WebhooksTable
].freeze

ACTION_LINES = %w[
  dynamodb:GetItem dynamodb:BatchGetItem dynamodb:BatchWriteItem dynamodb:PutItem dynamodb:DeleteItem
  dynamodb:UpdateItem dynamodb:Query dynamodb:Scan dynamodb:DescribeTable dynamodb:ConditionCheckItem
].freeze

def table_ar_lines(tbl)
  [
    "                - !Sub arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${#{tbl}}",
    "                - !Sub arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${#{tbl}}/index/*"
  ]
end

def shard_yaml(letter, refs)
  acts = ACTION_LINES.map { |a| "              - #{a}" }.join("\n")
  res = refs.flat_map { |t| table_ar_lines(t) }.join("\n")
  <<~YAML
    AppManagedPolicyDynamoLambdaCrudShard#{letter}:
      Type: AWS::IAM::ManagedPolicy
      Properties:
        ManagedPolicyName: !Sub "${AppName}-lambda-ddb-crud-${DeploymentStage}-#{letter.downcase}"
        PolicyDocument:
          Version: "2012-10-17"
          Statement:
            - Sid: DynamoApplicationShard#{letter}
              Effect: Allow
              Action:
  #{acts}
              Resource:
  #{res}
  YAML
end

def managed_policies_yaml
  shards = TABLE_REFS.each_slice((TABLE_REFS.size / 3.0).ceil).to_a
  raise unless shards.size == 3

  frags = +""
  frags << "# Shared DynamoDB + S3 managed policies shrink SAM-expanded IAM (policy templates inlined per function).\n"
  frags << shard_yaml("A", shards[0])
  frags << "\n"
  frags << shard_yaml("B", shards[1])
  frags << "\n"
  frags << shard_yaml("C", shards[2])
  # Note: literal two-space YAML root indent (logical id lives under Resources:)
  frags << <<~YAML
    AppManagedPolicyS3ApplicationBucketsCrud:
      Type: AWS::IAM::ManagedPolicy
      Properties:
        ManagedPolicyName: !Sub "${AppName}-lambda-s3-app-${DeploymentStage}"
        PolicyDocument:
          Version: "2012-10-17"
          Statement:
            - Sid: ListBuckets
              Effect: Allow
              Action:
                - s3:ListBucket
                - s3:GetBucketLocation
              Resource:
                - !Sub arn:aws:s3:::${AssetsBucket}
                - !Sub arn:aws:s3:::${BillingInvoicesBucket}
                - !Sub arn:aws:s3:::${BillingPosBucket}
            - Sid: Objects
              Effect: Allow
              Action:
                - s3:GetObject
                - s3:GetObjectAcl
                - s3:GetObjectVersion
                - s3:PutObject
                - s3:PutObjectAcl
                - s3:DeleteObject
                - s3:AbortMultipartUpload
                - s3:ListMultipartUploadParts
              Resource:
                - !Sub arn:aws:s3:::${AssetsBucket}/*
                - !Sub arn:aws:s3:::${BillingInvoicesBucket}/*
                - !Sub arn:aws:s3:::${BillingPosBucket}/*
  YAML
  frags
end

def remove_orphan_billing_roles(txt)
  a = txt.index("\n  RapidCortexBillingLambdaRole:\n")
  return txt unless a

  b = txt.index("\n  OpsAlertsTopic:\n", a)
  return txt unless b

  txt[0...a] + txt[b + 1..]
end

def next_properties_sibling(blob, idx)
  # Next top-level Logical ID beneath Resources (`  LogicalId:` at column 3)
  m = /\n\n  [A-Z][a-zA-Z0-9]*:/.match(blob, idx)
  m ? m.begin(0) : nil
end

def policies_section_end(blob, pol_start)
  # First SAM Properties child key after Policies (excluding Policy list items indented 8+)
  search_from = pol_start + 1
  keys = []
  [:Events, :VpcConfig, :Role, :ReservedConcurrentExecutions, :AutoPublishAlias, :Tracing, :Layers,
   :DeploymentPreference].each do |k|
    j = blob.index("\n      #{k}:\n", search_from)
    keys << j if j
  end
  nk = blob.index("\n      FunctionName:\n", search_from)
  keys << nk if nk
  cand = keys.compact.min
  return cand if cand

  # Policies may be last key (e.g. Retention executor with no Events)
  next_logical = next_properties_sibling(blob, pol_start)
  next_logical || blob.length
end

def dedupe_templates_in_policies_body(inner)
  lines = inner.lines
  out = []
  stripped_dd = false
  stripped_s3 = false
  i = 0
  while i < lines.size
    ln = lines[i]
    case ln
    when /\A {8}- DynamoDBCrudPolicy:\s*$/
      i += 1
      stripped_dd = true
      next unless lines[i]&.match(/\A {12}TableName: !Ref/)

      i += 1
      next
    when /\A {8}- DynamoDBReadPolicy:\s*$/
      i += 1
      stripped_dd = true
      next unless lines[i]&.match(/\A {12}TableName: !Ref/)

      i += 1
      next
    when /\A {8}- S3CrudPolicy:\s*$/
      i += 1
      stripped_s3 = true
      next unless lines[i]&.match(/\A {12}BucketName: !Ref/)

      i += 1
      next
    when /\A {8}- S3ReadPolicy:\s*$/
      i += 1
      stripped_s3 = true
      next unless lines[i]&.match(/\A {12}BucketName: !Ref/)

      i += 1
      next
    else
      out << ln
      i += 1
    end
  end

  prefixes = +""
  if stripped_dd
    %w[A B C].each { |sx| prefixes << "        - !Ref AppManagedPolicyDynamoLambdaCrudShard#{sx}\n" }
  end
  prefixes << "        - !Ref AppManagedPolicyS3ApplicationBucketsCrud\n" if stripped_s3

  "#{prefixes}#{out.join}"
end

def patch_serverless_function_chunk(chunk)
  return chunk unless chunk.include?("\n    Type: AWS::Serverless::Function\n")

  pol_idx = chunk.index("\n      Policies:\n")
  return chunk unless pol_idx

  bod_start = pol_idx + "\n      Policies:\n".length
  bod_end = policies_section_end(chunk, pol_idx)
  return chunk if bod_end.nil? || bod_end <= bod_start

  inner_old = chunk[bod_start...bod_end]
  inner_new = dedupe_templates_in_policies_body(inner_old)
  "#{chunk[0...bod_start]}#{inner_new}#{chunk[bod_end..]}"
end

abort("missing #{PATH}") unless File.file?(PATH)

text = File.read(PATH, encoding: "UTF-8")
abort("markers already present — delete AppManagedPolicy* first if rerunning") if text.include?("AppManagedPolicyDynamoLambdaCrudShardA:")

unless text =~ /\A([\s\S]*?^Resources:\n)([\s\S]*)\z/m
  abort("Resources section missing")
end

prem, res_tail = ::Regexp.last_match(1), ::Regexp.last_match(2)

# Split logical resources preserving order
chunks = []
buf = +""
res_tail.each_line do |ln|
  if ln =~ /\A  [A-Z][a-zA-Z0-9]*:/ && buf != +""
    chunks << buf
    buf = +""
  end
  buf << ln
end
chunks << buf unless buf.empty?

new_chunks =
  chunks.map do |chunk|
    logical = chunk[/\A  ([A-Za-z0-9]+):/, 1]
    next(chunk) if logical == "Outputs"

    c = chunk
    c = patch_serverless_function_chunk(c) if logical
    c
  end

text_out = prem + managed_policies_yaml + "\n" + new_chunks.join
text_out = remove_orphan_billing_roles(text_out)

File.write(PATH, text_out, encoding: "UTF-8")
puts "Wrote #{PATH} (safe SAM template stripping + managed policies)"
