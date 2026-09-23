# @barndoor-ai/sdk@2.0.0

A TypeScript SDK client for the platform.barndoor.ai API.

## Usage

First, install the SDK from npm.

```bash
npm install @barndoor-ai/sdk --save
```

Next, try it out.


```ts
import {
  Configuration,
  DlpApi,
} from '@barndoor-ai/sdk';
import type { CreateAllowListEntryOperationRequest } from '@barndoor-ai/sdk';

async function example() {
  console.log("🚀 Testing @barndoor-ai/sdk SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: OAuth2 application
    accessToken: "YOUR ACCESS TOKEN",
    // To configure OAuth2 access token for authorization: OAuth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
    // Configure HTTP bearer authorization: ApiKey
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DlpApi(config);

  const body = {
    // CreateAllowListEntryRequest
    createAllowListEntryRequest: ...,
  } satisfies CreateAllowListEntryOperationRequest;

  try {
    const data = await api.createAllowListEntry(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```


## Documentation

### API Endpoints

All URIs are relative to *https://platform.barndoor.ai*

| Class | Method | HTTP request | Description
| ----- | ------ | ------------ | -------------
*DlpApi* | [**createAllowListEntry**](docs/DlpApi.md#createallowlistentryoperation) | **POST** /api/dlp/admin/v1/allow-list | Create an allow-list entry
*DlpApi* | [**createCustomDetectionType**](docs/DlpApi.md#createcustomdetectiontypeoperation) | **POST** /api/dlp/admin/v1/custom-detection-types | Create a custom detection type
*DlpApi* | [**createDetectionEngine**](docs/DlpApi.md#createdetectionengineoperation) | **POST** /api/dlp/admin/v1/detection-engines | Create a detection engine
*DlpApi* | [**createEnforcementPolicy**](docs/DlpApi.md#createenforcementpolicyoperation) | **POST** /api/dlp/admin/v1/enforcement-policies | Create an enforcement policy
*DlpApi* | [**deleteAllowListEntry**](docs/DlpApi.md#deleteallowlistentry) | **DELETE** /api/dlp/admin/v1/allow-list/{id} | Delete an allow-list entry
*DlpApi* | [**deleteCustomDetectionType**](docs/DlpApi.md#deletecustomdetectiontype) | **DELETE** /api/dlp/admin/v1/custom-detection-types/{id} | Delete a custom detection type
*DlpApi* | [**deleteDetectionEngine**](docs/DlpApi.md#deletedetectionengine) | **DELETE** /api/dlp/admin/v1/detection-engines/{id} | Delete a detection engine
*DlpApi* | [**deleteEnforcementPolicy**](docs/DlpApi.md#deleteenforcementpolicy) | **DELETE** /api/dlp/admin/v1/enforcement-policies/{id} | Delete an enforcement policy
*DlpApi* | [**deleteFieldControlPolicy**](docs/DlpApi.md#deletefieldcontrolpolicy) | **DELETE** /api/dlp/admin/v1/field-control-policies/{id} | Delete a field-control policy
*DlpApi* | [**deleteProviderConnection**](docs/DlpApi.md#deleteproviderconnection) | **DELETE** /api/dlp/admin/v1/provider-connections/{name} | Delete a provider connection and its stored secrets
*DlpApi* | [**getConfig**](docs/DlpApi.md#getconfig) | **GET** /api/dlp/admin/v1/config | Get the organization\&#39;s DLP configuration
*DlpApi* | [**getCustomDetectionType**](docs/DlpApi.md#getcustomdetectiontype) | **GET** /api/dlp/admin/v1/custom-detection-types/{id} | Fetch one custom detection type
*DlpApi* | [**getDetectionEngine**](docs/DlpApi.md#getdetectionengine) | **GET** /api/dlp/admin/v1/detection-engines/{id} | Fetch one detection engine
*DlpApi* | [**getEnforcementPolicy**](docs/DlpApi.md#getenforcementpolicy) | **GET** /api/dlp/admin/v1/enforcement-policies/{id} | Fetch one enforcement policy
*DlpApi* | [**getFieldControlPolicy**](docs/DlpApi.md#getfieldcontrolpolicy) | **GET** /api/dlp/admin/v1/field-control-policies/{id} | Fetch one field-control policy
*DlpApi* | [**getProviderConnection**](docs/DlpApi.md#getproviderconnection) | **GET** /api/dlp/admin/v1/provider-connections/{name} | Fetch one provider connection
*DlpApi* | [**getResolvedProtection**](docs/DlpApi.md#getresolvedprotection) | **GET** /api/dlp/admin/v1/policies/resolved | Resolve the effective protection rules for a scope
*DlpApi* | [**listAllowList**](docs/DlpApi.md#listallowlist) | **GET** /api/dlp/admin/v1/allow-list | List the organization\&#39;s allow-list entries
*DlpApi* | [**listCustomDetectionTypes**](docs/DlpApi.md#listcustomdetectiontypes) | **GET** /api/dlp/admin/v1/custom-detection-types | List the organization\&#39;s custom detection types
*DlpApi* | [**listDetectionEngines**](docs/DlpApi.md#listdetectionengines) | **GET** /api/dlp/admin/v1/detection-engines | List the organization\&#39;s detection engines
*DlpApi* | [**listDetectionTypes**](docs/DlpApi.md#listdetectiontypes) | **GET** /api/dlp/admin/v1/detection-types | List every detection type available to the organization
*DlpApi* | [**listEnforcementPolicies**](docs/DlpApi.md#listenforcementpolicies) | **GET** /api/dlp/admin/v1/enforcement-policies | List the organization\&#39;s enforcement policies
*DlpApi* | [**listFieldControlPolicies**](docs/DlpApi.md#listfieldcontrolpolicies) | **GET** /api/dlp/admin/v1/field-control-policies | List the organization\&#39;s field-control policies
*DlpApi* | [**listProviderConnections**](docs/DlpApi.md#listproviderconnections) | **GET** /api/dlp/admin/v1/provider-connections | List the organization\&#39;s provider connections
*DlpApi* | [**providerConnectionAwsRoleConfig**](docs/DlpApi.md#providerconnectionawsroleconfig) | **GET** /api/dlp/admin/v1/provider-connections/aws-role-config | Get Barndoor\&#39;s AWS principal for role-assumption trust policies
*DlpApi* | [**providerConnectionAwsTrustInfo**](docs/DlpApi.md#providerconnectionawstrustinfo) | **GET** /api/dlp/admin/v1/provider-connections/{name}/aws-trust-info | Get the principal and external id for a connection\&#39;s trust policy
*DlpApi* | [**testProcessText**](docs/DlpApi.md#testprocesstextoperation) | **POST** /api/dlp/admin/v1/test/process-text | Run a sample through the organization\&#39;s live DLP pipeline
*DlpApi* | [**updateConfig**](docs/DlpApi.md#updateconfig) | **PUT** /api/dlp/admin/v1/config | Update the organization\&#39;s DLP configuration
*DlpApi* | [**updateCustomDetectionType**](docs/DlpApi.md#updatecustomdetectiontypeoperation) | **PUT** /api/dlp/admin/v1/custom-detection-types/{id} | Update a custom detection type
*DlpApi* | [**updateDetectionEngine**](docs/DlpApi.md#updatedetectionengineoperation) | **PUT** /api/dlp/admin/v1/detection-engines/{id} | Update a detection engine
*DlpApi* | [**updateEnforcementPolicy**](docs/DlpApi.md#updateenforcementpolicyoperation) | **PUT** /api/dlp/admin/v1/enforcement-policies/{id} | Update an enforcement policy
*DlpApi* | [**updateFieldControlPolicy**](docs/DlpApi.md#updatefieldcontrolpolicyoperation) | **PUT** /api/dlp/admin/v1/field-control-policies/{id} | Update a field-control policy
*DlpApi* | [**upsertConnection**](docs/DlpApi.md#upsertconnectionoperation) | **PUT** /api/dlp/admin/v1/provider-connections/{name} | Create or update a provider connection
*DlpApi* | [**upsertFieldControlPolicy**](docs/DlpApi.md#upsertfieldcontrolpolicyoperation) | **POST** /api/dlp/admin/v1/field-control-policies | Create or replace the field-control policy for an MCP server
*DlpApi* | [**validateAwsRole**](docs/DlpApi.md#validateawsroleoperation) | **POST** /api/dlp/admin/v1/provider-connections/aws-role-validate | Probe an AWS role Barndoor is meant to assume
*IdentityApi* | [**createIdpConnection**](docs/IdentityApi.md#createidpconnection) | **POST** /api/identity/public/v1/idp/connection | Create Idp Connection
*IdentityApi* | [**deleteIdpConnection**](docs/IdentityApi.md#deleteidpconnection) | **DELETE** /api/identity/public/v1/idp/connection | Delete Idp Connection
*IdentityApi* | [**getIdpConfig**](docs/IdentityApi.md#getidpconfig) | **GET** /api/identity/public/v1/idp/config | Get Idp Config
*IdentityApi* | [**getIdpConnection**](docs/IdentityApi.md#getidpconnection) | **GET** /api/identity/public/v1/idp/connection | Get Idp Connection
*IdentityApi* | [**getIdpSettings**](docs/IdentityApi.md#getidpsettings) | **GET** /api/identity/public/v1/idp/settings | Get Idp Settings
*IdentityApi* | [**listRolesAndGroups**](docs/IdentityApi.md#listrolesandgroups) | **GET** /api/identity/public/v1/users/roles-groups | Get Organization Roles Groups
*IdentityApi* | [**testIdpConnection**](docs/IdentityApi.md#testidpconnection) | **POST** /api/identity/public/v1/idp/test | Test Idp Connection
*IdentityApi* | [**updateIdpConfig**](docs/IdentityApi.md#updateidpconfig) | **PUT** /api/identity/public/v1/idp/config | Update Idp Config
*IdentityApi* | [**updateIdpConnection**](docs/IdentityApi.md#updateidpconnection) | **PUT** /api/identity/public/v1/idp/connection | Update Idp Connection
*LlmGatewayApi* | [**addRouteGroupMembers**](docs/LlmGatewayApi.md#addroutegroupmembersoperation) | **POST** /api/llm-gateway/admin/model-route-groups/{id}/members | Add models to a route group
*LlmGatewayApi* | [**archivePricing**](docs/LlmGatewayApi.md#archivepricing) | **DELETE** /api/llm-gateway/admin/model-pricing/{id} | Delete a model pricing rule
*LlmGatewayApi* | [**awsRoleConfig**](docs/LlmGatewayApi.md#awsroleconfig) | **GET** /api/llm-gateway/admin/connections/aws-role-config | Get Barndoor\&#39;s AWS principal for role-assumption trust policies
*LlmGatewayApi* | [**awsTrustInfo**](docs/LlmGatewayApi.md#awstrustinfo) | **GET** /api/llm-gateway/admin/connections/{id}/aws-trust-info | Get the trust-policy principal and external id for a provider connection
*LlmGatewayApi* | [**createApiKey**](docs/LlmGatewayApi.md#createapikeyoperation) | **POST** /api/llm-gateway/admin/api-keys | Create a API key
*LlmGatewayApi* | [**createBudget**](docs/LlmGatewayApi.md#createbudgetoperation) | **POST** /api/llm-gateway/admin/budgets | Create a token budget
*LlmGatewayApi* | [**createConnection**](docs/LlmGatewayApi.md#createconnectionoperation) | **POST** /api/llm-gateway/admin/connections | Create a provider connection
*LlmGatewayApi* | [**createModelAccess**](docs/LlmGatewayApi.md#createmodelaccessoperation) | **POST** /api/llm-gateway/admin/model-access | Create a model-access policy
*LlmGatewayApi* | [**createModelMapping**](docs/LlmGatewayApi.md#createmodelmappingoperation) | **POST** /api/llm-gateway/admin/model-mappings | Create a model mapping
*LlmGatewayApi* | [**createPricing**](docs/LlmGatewayApi.md#createpricingoperation) | **POST** /api/llm-gateway/admin/model-pricing | Create a model pricing rule
*LlmGatewayApi* | [**createProfile**](docs/LlmGatewayApi.md#createprofileoperation) | **POST** /api/llm-gateway/admin/agent-runtime-profiles | Create an agent runtime profile
*LlmGatewayApi* | [**createProvider**](docs/LlmGatewayApi.md#createprovideroperation) | **POST** /api/llm-gateway/admin/providers | Create a provider
*LlmGatewayApi* | [**createRateLimit**](docs/LlmGatewayApi.md#createratelimitoperation) | **POST** /api/llm-gateway/admin/rate-limits | Create a rate-limit policy
*LlmGatewayApi* | [**createRouteGroup**](docs/LlmGatewayApi.md#createroutegroupoperation) | **POST** /api/llm-gateway/admin/model-route-groups | Create a model route group
*LlmGatewayApi* | [**createRoutingPolicy**](docs/LlmGatewayApi.md#createroutingpolicy) | **POST** /api/llm-gateway/admin/routing-policies | Create a routing policy
*LlmGatewayApi* | [**createRoutingRule**](docs/LlmGatewayApi.md#createroutingrule) | **POST** /api/llm-gateway/admin/routing-rules | Create a routing rule
*LlmGatewayApi* | [**deleteBudget**](docs/LlmGatewayApi.md#deletebudget) | **DELETE** /api/llm-gateway/admin/budgets/{id} | Delete a token budget
*LlmGatewayApi* | [**deleteConnection**](docs/LlmGatewayApi.md#deleteconnection) | **DELETE** /api/llm-gateway/admin/connections/{id} | Delete a provider connection
*LlmGatewayApi* | [**deleteModelAccess**](docs/LlmGatewayApi.md#deletemodelaccess) | **DELETE** /api/llm-gateway/admin/model-access/{id} | Delete a model-access policy
*LlmGatewayApi* | [**deleteModelMapping**](docs/LlmGatewayApi.md#deletemodelmapping) | **DELETE** /api/llm-gateway/admin/model-mappings/{id} | Delete a model mapping
*LlmGatewayApi* | [**deleteProfile**](docs/LlmGatewayApi.md#deleteprofile) | **DELETE** /api/llm-gateway/admin/agent-runtime-profiles/{slug} | Delete an agent runtime profile
*LlmGatewayApi* | [**deleteProvider**](docs/LlmGatewayApi.md#deleteprovider) | **DELETE** /api/llm-gateway/admin/providers/{id} | Delete a provider
*LlmGatewayApi* | [**deleteRateLimit**](docs/LlmGatewayApi.md#deleteratelimit) | **DELETE** /api/llm-gateway/admin/rate-limits/{id} | Delete a rate-limit policy
*LlmGatewayApi* | [**deleteRouteGroup**](docs/LlmGatewayApi.md#deleteroutegroup) | **DELETE** /api/llm-gateway/admin/model-route-groups/{id} | Delete a model route group
*LlmGatewayApi* | [**deleteRoutingPolicy**](docs/LlmGatewayApi.md#deleteroutingpolicy) | **DELETE** /api/llm-gateway/admin/routing-policies/{id} | Delete a routing policy
*LlmGatewayApi* | [**deleteRoutingRule**](docs/LlmGatewayApi.md#deleteroutingrule) | **DELETE** /api/llm-gateway/admin/routing-rules/{id} | Delete a routing rule
*LlmGatewayApi* | [**getApiKey**](docs/LlmGatewayApi.md#getapikey) | **GET** /api/llm-gateway/admin/api-keys/{id} | Fetch one API key
*LlmGatewayApi* | [**getConnection**](docs/LlmGatewayApi.md#getconnection) | **GET** /api/llm-gateway/admin/connections/{id} | Fetch one provider connection
*LlmGatewayApi* | [**getGovernanceConfig**](docs/LlmGatewayApi.md#getgovernanceconfig) | **GET** /api/llm-gateway/admin/governance-config | List the organization\&#39;s governance configurations
*LlmGatewayApi* | [**getProfile**](docs/LlmGatewayApi.md#getprofile) | **GET** /api/llm-gateway/admin/agent-runtime-profiles/{slug} | Fetch one agent runtime profile
*LlmGatewayApi* | [**getProvider**](docs/LlmGatewayApi.md#getprovider) | **GET** /api/llm-gateway/admin/providers/{id} | Fetch one provider
*LlmGatewayApi* | [**listAllModelMappings**](docs/LlmGatewayApi.md#listallmodelmappings) | **GET** /api/llm-gateway/admin/model-mappings | List the organization\&#39;s model mappings
*LlmGatewayApi* | [**listApiKeys**](docs/LlmGatewayApi.md#listapikeys) | **GET** /api/llm-gateway/admin/api-keys | List the organization\&#39;s API keys
*LlmGatewayApi* | [**listArchivedPricing**](docs/LlmGatewayApi.md#listarchivedpricing) | **GET** /api/llm-gateway/admin/model-pricing/archived | List the organization\&#39;s archived pricing rules
*LlmGatewayApi* | [**listBudgets**](docs/LlmGatewayApi.md#listbudgets) | **GET** /api/llm-gateway/admin/budgets | List the organization\&#39;s token budgets
*LlmGatewayApi* | [**listConnections**](docs/LlmGatewayApi.md#listconnections) | **GET** /api/llm-gateway/admin/connections | List the organization\&#39;s provider connections
*LlmGatewayApi* | [**listDefaults**](docs/LlmGatewayApi.md#listdefaults) | **GET** /api/llm-gateway/admin/model-pricing/defaults | List the built-in default model pricing
*LlmGatewayApi* | [**listModelAccess**](docs/LlmGatewayApi.md#listmodelaccess) | **GET** /api/llm-gateway/admin/model-access | List the organization\&#39;s model-access policys
*LlmGatewayApi* | [**listModelMappings**](docs/LlmGatewayApi.md#listmodelmappings) | **GET** /api/llm-gateway/admin/providers/{provider_id}/model-mappings | List the model mappings for one provider
*LlmGatewayApi* | [**listPricing**](docs/LlmGatewayApi.md#listpricing) | **GET** /api/llm-gateway/admin/model-pricing | List the organization\&#39;s model pricing rules
*LlmGatewayApi* | [**listPricingHistory**](docs/LlmGatewayApi.md#listpricinghistory) | **GET** /api/llm-gateway/admin/model-pricing/history | List the change history for the organization\&#39;s pricing rules
*LlmGatewayApi* | [**listProfiles**](docs/LlmGatewayApi.md#listprofiles) | **GET** /api/llm-gateway/admin/agent-runtime-profiles | List the organization\&#39;s agent runtime profiles
*LlmGatewayApi* | [**listProviders**](docs/LlmGatewayApi.md#listproviders) | **GET** /api/llm-gateway/admin/providers | List the organization\&#39;s providers
*LlmGatewayApi* | [**listRateLimits**](docs/LlmGatewayApi.md#listratelimits) | **GET** /api/llm-gateway/admin/rate-limits | List the organization\&#39;s rate-limit policys
*LlmGatewayApi* | [**listRouteGroups**](docs/LlmGatewayApi.md#listroutegroups) | **GET** /api/llm-gateway/admin/model-route-groups | List the organization\&#39;s model route groups
*LlmGatewayApi* | [**listRoutingPolicies**](docs/LlmGatewayApi.md#listroutingpolicies) | **GET** /api/llm-gateway/admin/routing-policies | List the organization\&#39;s routing policys
*LlmGatewayApi* | [**listRoutingRules**](docs/LlmGatewayApi.md#listroutingrules) | **GET** /api/llm-gateway/admin/routing-rules | List the organization\&#39;s routing rules
*LlmGatewayApi* | [**lookupPricingVersion**](docs/LlmGatewayApi.md#lookuppricingversion) | **GET** /api/llm-gateway/admin/model-pricing/version/{id} | Fetch one version of a pricing rule
*LlmGatewayApi* | [**patchProfileMetadata**](docs/LlmGatewayApi.md#patchprofilemetadata) | **PATCH** /api/llm-gateway/admin/agent-runtime-profiles/{slug} | Update a profile\&#39;s display metadata
*LlmGatewayApi* | [**removeRouteGroupMember**](docs/LlmGatewayApi.md#removeroutegroupmember) | **DELETE** /api/llm-gateway/admin/model-route-groups/{id}/members/{alias} | Remove a model from a route group
*LlmGatewayApi* | [**reorderModelMappings**](docs/LlmGatewayApi.md#reordermodelmappingsoperation) | **PUT** /api/llm-gateway/admin/model-mappings/reorder | Reorder the organization\&#39;s model mappings
*LlmGatewayApi* | [**revokeApiKey**](docs/LlmGatewayApi.md#revokeapikey) | **DELETE** /api/llm-gateway/admin/api-keys/{id} | Delete a API key
*LlmGatewayApi* | [**setApiKeyDisabled**](docs/LlmGatewayApi.md#setapikeydisabledoperation) | **PATCH** /api/llm-gateway/admin/api-keys/{id} | Update a API key
*LlmGatewayApi* | [**setProfileDefault**](docs/LlmGatewayApi.md#setprofiledefault) | **POST** /api/llm-gateway/admin/agent-runtime-profiles/{slug}/default | Make this the organization\&#39;s default profile for its client
*LlmGatewayApi* | [**updateBudget**](docs/LlmGatewayApi.md#updatebudgetoperation) | **PUT** /api/llm-gateway/admin/budgets/{id} | Update a token budget
*LlmGatewayApi* | [**updateConnection**](docs/LlmGatewayApi.md#updateconnectionoperation) | **PUT** /api/llm-gateway/admin/connections/{id} | Update a provider connection
*LlmGatewayApi* | [**updateGovernanceConfig**](docs/LlmGatewayApi.md#updategovernanceconfig) | **PUT** /api/llm-gateway/admin/governance-config | Update a governance configuration
*LlmGatewayApi* | [**updateModelAccess**](docs/LlmGatewayApi.md#updatemodelaccessoperation) | **PUT** /api/llm-gateway/admin/model-access/{id} | Update a model-access policy
*LlmGatewayApi* | [**updateModelMapping**](docs/LlmGatewayApi.md#updatemodelmappingoperation) | **PUT** /api/llm-gateway/admin/model-mappings/{id} | Update a model mapping
*LlmGatewayApi* | [**updatePricing**](docs/LlmGatewayApi.md#updatepricingoperation) | **PUT** /api/llm-gateway/admin/model-pricing/{id} | Update a model pricing rule
*LlmGatewayApi* | [**updateProfileContract**](docs/LlmGatewayApi.md#updateprofilecontract) | **PUT** /api/llm-gateway/admin/agent-runtime-profiles/{slug} | Replace a profile\&#39;s capability contract
*LlmGatewayApi* | [**updateProvider**](docs/LlmGatewayApi.md#updateprovideroperation) | **PUT** /api/llm-gateway/admin/providers/{id} | Update a provider
*LlmGatewayApi* | [**updateRateLimit**](docs/LlmGatewayApi.md#updateratelimitoperation) | **PUT** /api/llm-gateway/admin/rate-limits/{id} | Update a rate-limit policy
*LlmGatewayApi* | [**updateRouteGroup**](docs/LlmGatewayApi.md#updateroutegroupoperation) | **PUT** /api/llm-gateway/admin/model-route-groups/{id} | Update a model route group
*LlmGatewayApi* | [**updateRoutingPolicy**](docs/LlmGatewayApi.md#updateroutingpolicy) | **PUT** /api/llm-gateway/admin/routing-policies/{id} | Update a routing policy
*LlmGatewayApi* | [**updateRoutingRule**](docs/LlmGatewayApi.md#updateroutingrule) | **PUT** /api/llm-gateway/admin/routing-rules/{id} | Update a routing rule
*NotificationApi* | [**deleteAlertChannel**](docs/NotificationApi.md#deletealertchannel) | **DELETE** /api/notification/public/v1/channels/{channel_id} | Delete a channel
*NotificationApi* | [**getMyAlertChannel**](docs/NotificationApi.md#getmyalertchannel) | **GET** /api/notification/public/v1/channels/user | List the caller\&#39;s personal channels
*NotificationApi* | [**listAlertChannelOptions**](docs/NotificationApi.md#listalertchanneloptions) | **GET** /api/notification/public/v1/channels/options | List the subscribable alert vocabulary
*NotificationApi* | [**listAlertChannels**](docs/NotificationApi.md#listalertchannels) | **GET** /api/notification/public/v1/channels | List the organization\&#39;s shared channels
*NotificationApi* | [**regenerateAlertChannelSecret**](docs/NotificationApi.md#regeneratealertchannelsecret) | **POST** /api/notification/public/v1/channels/{channel_id}/regenerate-secret | Rotate a webhook channel\&#39;s signing secret
*NotificationApi* | [**testAlertChannel**](docs/NotificationApi.md#testalertchannel) | **POST** /api/notification/public/v1/channels/{channel_id}/test | Send a test message through a channel
*NotificationApi* | [**upsertAlertChannel**](docs/NotificationApi.md#upsertalertchannel) | **PUT** /api/notification/public/v1/channels | Create or update a notification channel
*PolicyApi* | [**acknowledgePolicyImpact**](docs/PolicyApi.md#acknowledgepolicyimpact) | **POST** /api/policy/v2/policies/{policy_id}/impacts/{impact_id}/acknowledge | Acknowledge Policy Impact
*PolicyApi* | [**clonePolicy**](docs/PolicyApi.md#clonepolicy) | **POST** /api/policy/v2/policies/{policy_id}/clone | Clone Policy
*PolicyApi* | [**comparePolicyRevisions**](docs/PolicyApi.md#comparepolicyrevisions) | **GET** /api/policy/v2/policies/{policy_id}/revisions/compare | Compare Policy Revisions
*PolicyApi* | [**countPoliciesByAgent**](docs/PolicyApi.md#countpoliciesbyagent) | **GET** /api/policy/v2/policies/counts-by-agent | Get Policy Counts By Agent
*PolicyApi* | [**createPolicy**](docs/PolicyApi.md#createpolicy) | **POST** /api/policy/v2/policies | Create Policy
*PolicyApi* | [**getPolicy**](docs/PolicyApi.md#getpolicy) | **GET** /api/policy/v2/policies/{policy_id} | Get Policy
*PolicyApi* | [**getPolicyImpactsSummary**](docs/PolicyApi.md#getpolicyimpactssummary) | **GET** /api/policy/v2/policy-impacts/summary | Get Policy Impacts Summary
*PolicyApi* | [**getPolicyImpactsSummaryByKind**](docs/PolicyApi.md#getpolicyimpactssummarybykind) | **GET** /api/policy/v2/policy-impacts/summary/by-kind | Get Policy Impacts Summary By Kind
*PolicyApi* | [**getPolicyRevision**](docs/PolicyApi.md#getpolicyrevision) | **GET** /api/policy/v2/policies/{policy_id}/revisions/{revision_id} | Get Policy Revision
*PolicyApi* | [**getPolicySummary**](docs/PolicyApi.md#getpolicysummary) | **GET** /api/policy/v2/policies/summary | Get Policies Summary
*PolicyApi* | [**listAllPolicyImpacts**](docs/PolicyApi.md#listallpolicyimpacts) | **GET** /api/policy/v2/policy-impacts | List Policy Impacts
*PolicyApi* | [**listPolicies**](docs/PolicyApi.md#listpolicies) | **GET** /api/policy/v2/policies | List Policies
*PolicyApi* | [**listPoliciesAffectedBy**](docs/PolicyApi.md#listpoliciesaffectedby) | **GET** /api/policy/v2/policies/affected-by | Get Affected Policies
*PolicyApi* | [**listPolicyFilterOptions**](docs/PolicyApi.md#listpolicyfilteroptions) | **GET** /api/policy/v2/policies/filter-definitions | Get Filter Definitions
*PolicyApi* | [**listPolicyImpacts**](docs/PolicyApi.md#listpolicyimpacts) | **GET** /api/policy/v2/policies/{policy_id}/impacts | List Impacts For Policy
*PolicyApi* | [**listPolicyRevisions**](docs/PolicyApi.md#listpolicyrevisions) | **GET** /api/policy/v2/policies/{policy_id}/revisions | List Policy Revisions
*PolicyApi* | [**updatePolicy**](docs/PolicyApi.md#updatepolicy) | **PATCH** /api/policy/v2/policies/{policy_id} | Update Policy
*PolicyApi* | [**validatePolicy**](docs/PolicyApi.md#validatepolicyoperation) | **POST** /api/policy/v2/policies/validate | Validate Policy
*PolicyApi* | [**validatePolicyRule**](docs/PolicyApi.md#validatepolicyrule) | **POST** /api/policy/v2/policies/rule/validate | Validate Rule
*RegistryApi* | [**connectMcpServer**](docs/RegistryApi.md#connectmcpserver) | **POST** /api/registry/v1/servers/{server_id}/connect | Authenticate an already-registered server
*RegistryApi* | [**countAgentsByType**](docs/RegistryApi.md#countagentsbytype) | **GET** /api/registry/v1/agents/counts | Get Application Counts
*RegistryApi* | [**disconnectMcpServer**](docs/RegistryApi.md#disconnectmcpserver) | **DELETE** /api/registry/v1/servers/{server_id}/connection | Delete Connection
*RegistryApi* | [**getAgent**](docs/RegistryApi.md#getagent) | **GET** /api/registry/v1/agents/{application_id} | Get Application
*RegistryApi* | [**getAgentDirectoryEntry**](docs/RegistryApi.md#getagentdirectoryentry) | **GET** /api/registry/v1/agent-directory/{application_directory_id} | Get Application Directory
*RegistryApi* | [**getMcpServer**](docs/RegistryApi.md#getmcpserver) | **GET** /api/registry/v1/servers/{server_id} | Get Mcp Server
*RegistryApi* | [**getMcpServerBySlug**](docs/RegistryApi.md#getmcpserverbyslug) | **GET** /api/registry/v1/servers/by-slug/{slug} | Get Mcp Server By Slug
*RegistryApi* | [**getMcpServerConnection**](docs/RegistryApi.md#getmcpserverconnection) | **GET** /api/registry/v1/servers/{server_id}/connection | Get Connection
*RegistryApi* | [**getMcpServerDirectoryEntry**](docs/RegistryApi.md#getmcpserverdirectoryentry) | **GET** /api/registry/v1/server-directory/{server_directory_id} | Get Server Directory
*RegistryApi* | [**listActiveAgentIds**](docs/RegistryApi.md#listactiveagentids) | **GET** /api/registry/v1/applications/active-ids | Get Active Application Ids
*RegistryApi* | [**listActiveMcpDirectoryIds**](docs/RegistryApi.md#listactivemcpdirectoryids) | **GET** /api/registry/v1/server-directory/active-ids | Get Active Server Directory Ids
*RegistryApi* | [**listActiveMcpServerIds**](docs/RegistryApi.md#listactivemcpserverids) | **GET** /api/registry/v1/servers/active-ids | Get Active Server Ids
*RegistryApi* | [**listAgentDirectory**](docs/RegistryApi.md#listagentdirectory) | **GET** /api/registry/v1/agent-directory | List Applications Directory
*RegistryApi* | [**listAgents**](docs/RegistryApi.md#listagents) | **GET** /api/registry/v1/agents | List Applications
*RegistryApi* | [**listMcpServerDirectory**](docs/RegistryApi.md#listmcpserverdirectory) | **GET** /api/registry/v1/server-directory | List Server Directory
*RegistryApi* | [**listMcpServers**](docs/RegistryApi.md#listmcpservers) | **GET** /api/registry/v1/servers | Get Mcp Servers
*RegistryApi* | [**publishMcpServer**](docs/RegistryApi.md#publishmcpserver) | **POST** /api/registry/v1/servers/{server_id}/publish | Publish Mcp Server
*RegistryApi* | [**registerAgent**](docs/RegistryApi.md#registeragent) | **POST** /api/registry/v1/agents | Register Application
*RegistryApi* | [**reportMcpConnectionAuthError**](docs/RegistryApi.md#reportmcpconnectionautherror) | **POST** /api/registry/v1/servers/{server_id}/connection/auth-error | Report Connection Auth Error
*RegistryApi* | [**unregisterAgent**](docs/RegistryApi.md#unregisteragent) | **DELETE** /api/registry/v1/agents/{application_id} | Unregister Application
*RegistryApi* | [**updateAgentLlmGateway**](docs/RegistryApi.md#updateagentllmgateway) | **PATCH** /api/registry/v1/agents/{application_id}/llm-gateway | Update Application Llm Gateway
*RegistryApi* | [**updateAgentWriteConfirmations**](docs/RegistryApi.md#updateagentwriteconfirmations) | **PATCH** /api/registry/v1/agents/{application_id}/write-confirmations | Update Application Write Confirmations
*SystemManagementApi* | [**checkExportDestinationHealth**](docs/SystemManagementApi.md#checkexportdestinationhealth) | **POST** /api/system-management/public/v1/exports/{orgId}/{exportType}/destination/health-check | Probe an export\&#39;s destination and persist the result
*SystemManagementApi* | [**configureExportDestination**](docs/SystemManagementApi.md#configureexportdestination) | **PUT** /api/system-management/public/v1/exports/{orgId}/{exportType}/destination | Configure an export\&#39;s delivery destination
*SystemManagementApi* | [**deleteExportDestination**](docs/SystemManagementApi.md#deleteexportdestination) | **DELETE** /api/system-management/public/v1/exports/{orgId}/{exportType}/destination | Clear an export\&#39;s delivery destination and its stored credentials
*SystemManagementApi* | [**getExportAwsTrustInfo**](docs/SystemManagementApi.md#getexportawstrustinfo) | **GET** /api/system-management/public/v1/exports/{orgId}/{exportType}/destination/aws-trust-info | Get the AWS principal and external ID to trust for iam_role auth
*SystemManagementApi* | [**getExportDestination**](docs/SystemManagementApi.md#getexportdestination) | **GET** /api/system-management/public/v1/exports/{orgId}/{exportType}/destination | Get an export\&#39;s delivery destination
*SystemManagementApi* | [**getOrgExport**](docs/SystemManagementApi.md#getorgexport) | **GET** /api/system-management/public/v1/exports/{orgId}/{exportType} | Get one audit log export
*SystemManagementApi* | [**listOrgExports**](docs/SystemManagementApi.md#listorgexports) | **GET** /api/system-management/public/v1/exports/{orgId} | List an organization\&#39;s audit log exports
*SystemManagementApi* | [**pauseExport**](docs/SystemManagementApi.md#pauseexport) | **POST** /api/system-management/public/v1/exports/{orgId}/{exportType}/pause | Disable an export and stop delivery
*SystemManagementApi* | [**startExport**](docs/SystemManagementApi.md#startexport) | **POST** /api/system-management/public/v1/exports/{orgId}/{exportType}/start | Enable an export and resume delivery
*SystemManagementApi* | [**updateExportSettings**](docs/SystemManagementApi.md#updateexportsettings) | **PATCH** /api/system-management/public/v1/exports/{orgId}/{exportType}/settings | Update an export\&#39;s delivery settings


### Models

- [AWSTrustInfoResponse](docs/AWSTrustInfoResponse.md)
- [AddRouteGroupMembersRequest](docs/AddRouteGroupMembersRequest.md)
- [AdminModelPricing](docs/AdminModelPricing.md)
- [AffectedPoliciesResponse](docs/AffectedPoliciesResponse.md)
- [AffectedPolicyPreview](docs/AffectedPolicyPreview.md)
- [AgentPolicyCounts](docs/AgentPolicyCounts.md)
- [AgentRuntimeCapabilities](docs/AgentRuntimeCapabilities.md)
- [AgentRuntimeProfile](docs/AgentRuntimeProfile.md)
- [AgentType](docs/AgentType.md)
- [AlertType](docs/AlertType.md)
- [AlertTypeOption](docs/AlertTypeOption.md)
- [AllowListEntryResponse](docs/AllowListEntryResponse.md)
- [ApiKey](docs/ApiKey.md)
- [ApiKeyDisabledResponse](docs/ApiKeyDisabledResponse.md)
- [ApiKeyKind](docs/ApiKeyKind.md)
- [AppType](docs/AppType.md)
- [Application](docs/Application.md)
- [ApplicationCounts](docs/ApplicationCounts.md)
- [ApplicationDirectoryBase](docs/ApplicationDirectoryBase.md)
- [ApplicationDirectoryResponse](docs/ApplicationDirectoryResponse.md)
- [ApplicationLlmGatewayPayload](docs/ApplicationLlmGatewayPayload.md)
- [ApplicationPayload](docs/ApplicationPayload.md)
- [ApplicationResponse](docs/ApplicationResponse.md)
- [ApplicationWriteConfirmationsPayload](docs/ApplicationWriteConfirmationsPayload.md)
- [ArchivePricingResponse](docs/ArchivePricingResponse.md)
- [AttentionTier](docs/AttentionTier.md)
- [AutoDisabledReason](docs/AutoDisabledReason.md)
- [AwsBedrockGuardrailsConnectionResponse](docs/AwsBedrockGuardrailsConnectionResponse.md)
- [AwsComprehendPiiConnectionResponse](docs/AwsComprehendPiiConnectionResponse.md)
- [AwsRoleConfigResponse](docs/AwsRoleConfigResponse.md)
- [AwsRoleValidationResponse](docs/AwsRoleValidationResponse.md)
- [AzureAiLanguagePiiConnectionResponse](docs/AzureAiLanguagePiiConnectionResponse.md)
- [AzureContentSafetyConnectionResponse](docs/AzureContentSafetyConnectionResponse.md)
- [BillingMode](docs/BillingMode.md)
- [BillingReason](docs/BillingReason.md)
- [BudgetAction](docs/BudgetAction.md)
- [BudgetLimitKind](docs/BudgetLimitKind.md)
- [BudgetPeriod](docs/BudgetPeriod.md)
- [BudgetTargetKind](docs/BudgetTargetKind.md)
- [BudgetTargetStatus](docs/BudgetTargetStatus.md)
- [ChangeAttribution](docs/ChangeAttribution.md)
- [ChannelListResponse](docs/ChannelListResponse.md)
- [ChannelOptionsResponse](docs/ChannelOptionsResponse.md)
- [ChannelResponse](docs/ChannelResponse.md)
- [ChannelSubscription](docs/ChannelSubscription.md)
- [ChannelSubscriptionInput](docs/ChannelSubscriptionInput.md)
- [ChannelTestResponse](docs/ChannelTestResponse.md)
- [ChannelType](docs/ChannelType.md)
- [ChannelUpsertRequest](docs/ChannelUpsertRequest.md)
- [ConditionOfInput](docs/ConditionOfInput.md)
- [ConditionOfOutput](docs/ConditionOfOutput.md)
- [ConfigureDestinationRequest](docs/ConfigureDestinationRequest.md)
- [Connection](docs/Connection.md)
- [ConnectionInitiateResponse](docs/ConnectionInitiateResponse.md)
- [ConnectionRead](docs/ConnectionRead.md)
- [ConnectionStatus](docs/ConnectionStatus.md)
- [CreateAllowListEntryRequest](docs/CreateAllowListEntryRequest.md)
- [CreateApiKeyRequest](docs/CreateApiKeyRequest.md)
- [CreateApiKeyResponse](docs/CreateApiKeyResponse.md)
- [CreateBudgetRequest](docs/CreateBudgetRequest.md)
- [CreateConnectionRequest](docs/CreateConnectionRequest.md)
- [CreateCustomDetectionTypeRequest](docs/CreateCustomDetectionTypeRequest.md)
- [CreateDetectionEngineRequest](docs/CreateDetectionEngineRequest.md)
- [CreateEnforcementPolicyRequest](docs/CreateEnforcementPolicyRequest.md)
- [CreateModelAccessRequest](docs/CreateModelAccessRequest.md)
- [CreateModelMappingRequest](docs/CreateModelMappingRequest.md)
- [CreatePolicy](docs/CreatePolicy.md)
- [CreatePricingRequest](docs/CreatePricingRequest.md)
- [CreateProfileRequest](docs/CreateProfileRequest.md)
- [CreateProviderRequest](docs/CreateProviderRequest.md)
- [CreateRateLimitRequest](docs/CreateRateLimitRequest.md)
- [CreateRouteGroupRequest](docs/CreateRouteGroupRequest.md)
- [CredentialsPayload](docs/CredentialsPayload.md)
- [CustomDetectionPatternRequest](docs/CustomDetectionPatternRequest.md)
- [CustomDetectionPatternResponse](docs/CustomDetectionPatternResponse.md)
- [CustomDetectionTypeResponse](docs/CustomDetectionTypeResponse.md)
- [CustomDetectionTypesResponse](docs/CustomDetectionTypesResponse.md)
- [DefaultModelAccess](docs/DefaultModelAccess.md)
- [DefaultPricingEntry](docs/DefaultPricingEntry.md)
- [DeletedResponse](docs/DeletedResponse.md)
- [DestinationResponse](docs/DestinationResponse.md)
- [DetectionEngineCapabilitiesResponse](docs/DetectionEngineCapabilitiesResponse.md)
- [DetectionEngineResponse](docs/DetectionEngineResponse.md)
- [DetectionTypeInfoResponse](docs/DetectionTypeInfoResponse.md)
- [DetectionTypesResponse](docs/DetectionTypesResponse.md)
- [DlpAwsTrustInfoResponse](docs/DlpAwsTrustInfoResponse.md)
- [DlpErrorResponse](docs/DlpErrorResponse.md)
- [EffectivePricing](docs/EffectivePricing.md)
- [EnforcementPoliciesResponse](docs/EnforcementPoliciesResponse.md)
- [EnforcementPolicyMcpTargetRequest](docs/EnforcementPolicyMcpTargetRequest.md)
- [EnforcementPolicyMcpTargetResponse](docs/EnforcementPolicyMcpTargetResponse.md)
- [EnforcementPolicyPrincipalRequest](docs/EnforcementPolicyPrincipalRequest.md)
- [EnforcementPolicyPrincipalResponse](docs/EnforcementPolicyPrincipalResponse.md)
- [EnforcementPolicyResponse](docs/EnforcementPolicyResponse.md)
- [ErrorDetail](docs/ErrorDetail.md)
- [ErrorModel](docs/ErrorModel.md)
- [ExportDestination](docs/ExportDestination.md)
- [ExportHealthCheck](docs/ExportHealthCheck.md)
- [ExportResponse](docs/ExportResponse.md)
- [ExportRuntimeStatus](docs/ExportRuntimeStatus.md)
- [ExportSettings](docs/ExportSettings.md)
- [ExportsResponse](docs/ExportsResponse.md)
- [Expression](docs/Expression.md)
- [FieldControlPoliciesResponse](docs/FieldControlPoliciesResponse.md)
- [FieldControlPolicyResponse](docs/FieldControlPolicyResponse.md)
- [FilterCategory](docs/FilterCategory.md)
- [FilterOption](docs/FilterOption.md)
- [GoogleDlpConnectionResponse](docs/GoogleDlpConnectionResponse.md)
- [GovernanceConfig](docs/GovernanceConfig.md)
- [HTTPValidationError](docs/HTTPValidationError.md)
- [IdListResponse](docs/IdListResponse.md)
- [IdpConnectionConfig](docs/IdpConnectionConfig.md)
- [IdpConnectionResponse](docs/IdpConnectionResponse.md)
- [IdpRoleMappingConfig](docs/IdpRoleMappingConfig.md)
- [IdpRoleMappingResponse](docs/IdpRoleMappingResponse.md)
- [IdpSettingsResponse](docs/IdpSettingsResponse.md)
- [IdpTestResult](docs/IdpTestResult.md)
- [LabeledOption](docs/LabeledOption.md)
- [ListProfilesResponse](docs/ListProfilesResponse.md)
- [ListRoutingRulesResponse](docs/ListRoutingRulesResponse.md)
- [LlmGatewayAwsRoleConfigResponse](docs/LlmGatewayAwsRoleConfigResponse.md)
- [LlmGatewayAwsTrustInfoResponse](docs/LlmGatewayAwsTrustInfoResponse.md)
- [LocationInner](docs/LocationInner.md)
- [LongContextTier](docs/LongContextTier.md)
- [LongContextTierEntry](docs/LongContextTierEntry.md)
- [LongContextTierRequest](docs/LongContextTierRequest.md)
- [MCPServerCategory](docs/MCPServerCategory.md)
- [MCPServerDirectoryBase](docs/MCPServerDirectoryBase.md)
- [MCPServerDirectoryRead](docs/MCPServerDirectoryRead.md)
- [MCPServerDirectoryReadWithServers](docs/MCPServerDirectoryReadWithServers.md)
- [MaskFormat](docs/MaskFormat.md)
- [MaskKeep](docs/MaskKeep.md)
- [Match](docs/Match.md)
- [Match1](docs/Match1.md)
- [MetadataPatchRequest](docs/MetadataPatchRequest.md)
- [ModelAccessTarget](docs/ModelAccessTarget.md)
- [ModelAccessTargetOneOf](docs/ModelAccessTargetOneOf.md)
- [ModelAccessTargetOneOf1](docs/ModelAccessTargetOneOf1.md)
- [ModelAccessTargetOneOf2](docs/ModelAccessTargetOneOf2.md)
- [ModelAccessTargetOneOf3](docs/ModelAccessTargetOneOf3.md)
- [ModelAccessTargetOneOf4](docs/ModelAccessTargetOneOf4.md)
- [ModelMapping](docs/ModelMapping.md)
- [ModelMappingWithBudgetStatus](docs/ModelMappingWithBudgetStatus.md)
- [ModelMappingWithProvider](docs/ModelMappingWithProvider.md)
- [ModelMappingWithProviderAndBudgetStatus](docs/ModelMappingWithProviderAndBudgetStatus.md)
- [ModelPricing](docs/ModelPricing.md)
- [ModelRouteGroup](docs/ModelRouteGroup.md)
- [ModelSource](docs/ModelSource.md)
- [ModelStaleStatus](docs/ModelStaleStatus.md)
- [ModelSyncMode](docs/ModelSyncMode.md)
- [OAuthConfig](docs/OAuthConfig.md)
- [OfInner](docs/OfInner.md)
- [OfInner1](docs/OfInner1.md)
- [OperatorAllInput](docs/OperatorAllInput.md)
- [OperatorAllOutput](docs/OperatorAllOutput.md)
- [OperatorAnyInput](docs/OperatorAnyInput.md)
- [OperatorAnyOutput](docs/OperatorAnyOutput.md)
- [OperatorNoneInput](docs/OperatorNoneInput.md)
- [OperatorNoneOutput](docs/OperatorNoneOutput.md)
- [OrgConfigResponse](docs/OrgConfigResponse.md)
- [OrganizationRolesGroupsResponse](docs/OrganizationRolesGroupsResponse.md)
- [PaginatedResponseAllowListEntryResponse](docs/PaginatedResponseAllowListEntryResponse.md)
- [PaginatedResponseAllowListEntryResponseItemsInner](docs/PaginatedResponseAllowListEntryResponseItemsInner.md)
- [PaginationMeta](docs/PaginationMeta.md)
- [PaginationResponseApplicationDirectoryResponse](docs/PaginationResponseApplicationDirectoryResponse.md)
- [PaginationResponseApplicationResponse](docs/PaginationResponseApplicationResponse.md)
- [PaginationResponseMCPServerDirectoryReadWithServers](docs/PaginationResponseMCPServerDirectoryReadWithServers.md)
- [PaginationResponsePolicyImpactSummary](docs/PaginationResponsePolicyImpactSummary.md)
- [PaginationResponsePolicyRevisionSummary](docs/PaginationResponsePolicyRevisionSummary.md)
- [PaginationResponsePolicySummary](docs/PaginationResponsePolicySummary.md)
- [PaginationResponseServerListResponse](docs/PaginationResponseServerListResponse.md)
- [PolicyAttributionResponse](docs/PolicyAttributionResponse.md)
- [PolicyDetail](docs/PolicyDetail.md)
- [PolicyDetailResponse](docs/PolicyDetailResponse.md)
- [PolicyImpactSeverityCounts](docs/PolicyImpactSeverityCounts.md)
- [PolicyImpactSummary](docs/PolicyImpactSummary.md)
- [PolicyRevisionCompareResponse](docs/PolicyRevisionCompareResponse.md)
- [PolicyRevisionCompareSide](docs/PolicyRevisionCompareSide.md)
- [PolicyRevisionDetailResponse](docs/PolicyRevisionDetailResponse.md)
- [PolicyRevisionSummary](docs/PolicyRevisionSummary.md)
- [PolicyRuleConditionInput](docs/PolicyRuleConditionInput.md)
- [PolicyRuleConditionOutput](docs/PolicyRuleConditionOutput.md)
- [PolicyRuleInput](docs/PolicyRuleInput.md)
- [PolicyRuleOutput](docs/PolicyRuleOutput.md)
- [PolicyStatus](docs/PolicyStatus.md)
- [PolicySummary](docs/PolicySummary.md)
- [PolicySummaryResponse](docs/PolicySummaryResponse.md)
- [Posture](docs/Posture.md)
- [PresidioConnectionResponse](docs/PresidioConnectionResponse.md)
- [PricingChangeSource](docs/PricingChangeSource.md)
- [PricingRuleSummary](docs/PricingRuleSummary.md)
- [PricingSyncMode](docs/PricingSyncMode.md)
- [Protocol](docs/Protocol.md)
- [Provider](docs/Provider.md)
- [ProviderConnectionResponse](docs/ProviderConnectionResponse.md)
- [ProviderConnectionResponseOneOf](docs/ProviderConnectionResponseOneOf.md)
- [ProviderConnectionResponseOneOf1](docs/ProviderConnectionResponseOneOf1.md)
- [ProviderConnectionResponseOneOf2](docs/ProviderConnectionResponseOneOf2.md)
- [ProviderConnectionResponseOneOf3](docs/ProviderConnectionResponseOneOf3.md)
- [ProviderConnectionResponseOneOf4](docs/ProviderConnectionResponseOneOf4.md)
- [ProviderConnectionResponseOneOf5](docs/ProviderConnectionResponseOneOf5.md)
- [ProviderConnectionResponseOneOf6](docs/ProviderConnectionResponseOneOf6.md)
- [PublishBlocker](docs/PublishBlocker.md)
- [ReorderEntry](docs/ReorderEntry.md)
- [ReorderModelMappingsRequest](docs/ReorderModelMappingsRequest.md)
- [ReorderedResponse](docs/ReorderedResponse.md)
- [ResolvedProtectionResponse](docs/ResolvedProtectionResponse.md)
- [ResolvedProtectionRuleResponse](docs/ResolvedProtectionRuleResponse.md)
- [ResolvedRef](docs/ResolvedRef.md)
- [RevokedResponse](docs/RevokedResponse.md)
- [RouteHealthStatus](docs/RouteHealthStatus.md)
- [RoutingPolicy](docs/RoutingPolicy.md)
- [RoutingPolicyDraft](docs/RoutingPolicyDraft.md)
- [RoutingPolicyUpdate](docs/RoutingPolicyUpdate.md)
- [RoutingRule](docs/RoutingRule.md)
- [RoutingRuleDraft](docs/RoutingRuleDraft.md)
- [RoutingRuleWriteResponse](docs/RoutingRuleWriteResponse.md)
- [RoutingSlot](docs/RoutingSlot.md)
- [RuleConflict](docs/RuleConflict.md)
- [ScopeJson](docs/ScopeJson.md)
- [ScopeType](docs/ScopeType.md)
- [ServerConnectionResponse](docs/ServerConnectionResponse.md)
- [ServerListResponse](docs/ServerListResponse.md)
- [ServerResponse](docs/ServerResponse.md)
- [ServerSource](docs/ServerSource.md)
- [SetApiKeyDisabledRequest](docs/SetApiKeyDisabledRequest.md)
- [StaleReason](docs/StaleReason.md)
- [TestFindingResponse](docs/TestFindingResponse.md)
- [TestProcessTextRequest](docs/TestProcessTextRequest.md)
- [TestProcessTextResponse](docs/TestProcessTextResponse.md)
- [TokenizationConnectionResponse](docs/TokenizationConnectionResponse.md)
- [TrafficType](docs/TrafficType.md)
- [UpdateBudgetRequest](docs/UpdateBudgetRequest.md)
- [UpdateConnectionRequest](docs/UpdateConnectionRequest.md)
- [UpdateContractRequest](docs/UpdateContractRequest.md)
- [UpdateCustomDetectionTypeRequest](docs/UpdateCustomDetectionTypeRequest.md)
- [UpdateDetectionEngineRequest](docs/UpdateDetectionEngineRequest.md)
- [UpdateEnforcementPolicyRequest](docs/UpdateEnforcementPolicyRequest.md)
- [UpdateFieldControlPolicyRequest](docs/UpdateFieldControlPolicyRequest.md)
- [UpdateModelAccessRequest](docs/UpdateModelAccessRequest.md)
- [UpdateModelMappingRequest](docs/UpdateModelMappingRequest.md)
- [UpdateOrgConfigRequest](docs/UpdateOrgConfigRequest.md)
- [UpdatePolicy](docs/UpdatePolicy.md)
- [UpdatePricingRequest](docs/UpdatePricingRequest.md)
- [UpdateProviderRequest](docs/UpdateProviderRequest.md)
- [UpdateRateLimitRequest](docs/UpdateRateLimitRequest.md)
- [UpdateRouteGroupRequest](docs/UpdateRouteGroupRequest.md)
- [UpdateSettingsRequest](docs/UpdateSettingsRequest.md)
- [UpsertAwsBedrockGuardrailsRequest](docs/UpsertAwsBedrockGuardrailsRequest.md)
- [UpsertAwsComprehendPiiRequest](docs/UpsertAwsComprehendPiiRequest.md)
- [UpsertAzureAiLanguagePiiRequest](docs/UpsertAzureAiLanguagePiiRequest.md)
- [UpsertAzureContentSafetyRequest](docs/UpsertAzureContentSafetyRequest.md)
- [UpsertConnectionRequest](docs/UpsertConnectionRequest.md)
- [UpsertConnectionRequestOneOf](docs/UpsertConnectionRequestOneOf.md)
- [UpsertConnectionRequestOneOf1](docs/UpsertConnectionRequestOneOf1.md)
- [UpsertConnectionRequestOneOf2](docs/UpsertConnectionRequestOneOf2.md)
- [UpsertConnectionRequestOneOf3](docs/UpsertConnectionRequestOneOf3.md)
- [UpsertConnectionRequestOneOf4](docs/UpsertConnectionRequestOneOf4.md)
- [UpsertConnectionRequestOneOf5](docs/UpsertConnectionRequestOneOf5.md)
- [UpsertConnectionRequestOneOf6](docs/UpsertConnectionRequestOneOf6.md)
- [UpsertFieldControlPolicyRequest](docs/UpsertFieldControlPolicyRequest.md)
- [UpsertGoogleDlpRequest](docs/UpsertGoogleDlpRequest.md)
- [UpsertPresidioRequest](docs/UpsertPresidioRequest.md)
- [UpsertTokenizationRequest](docs/UpsertTokenizationRequest.md)
- [ValidateAwsRoleRequest](docs/ValidateAwsRoleRequest.md)
- [ValidatePolicyRequest](docs/ValidatePolicyRequest.md)
- [ValidatePolicyResponse](docs/ValidatePolicyResponse.md)
- [ValidationError](docs/ValidationError.md)
- [WebhookSecretResponse](docs/WebhookSecretResponse.md)
- [WithAttributionModelAccessPolicy](docs/WithAttributionModelAccessPolicy.md)
- [WithAttributionRateLimitPolicy](docs/WithAttributionRateLimitPolicy.md)
- [WithAttributionTokenBudget](docs/WithAttributionTokenBudget.md)

### Authorization


Authentication schemes defined for the API:
<a id="ApiKey"></a>
#### ApiKey


- **Type**: HTTP Bearer Token authentication
<a id="OAuth2-application"></a>
#### OAuth2 application


- **Type**: OAuth
- **Flow**: application
- **Authorization URL**: 
- **Scopes**: 
  - `openid`: Issue an OIDC ID token identifying the caller.
  - `profile`: Read the caller\&#39;s basic profile claims.
  - `email`: Read the caller\&#39;s email address.
  - `offline_access`: Issue a refresh token. Optional — no operation requires it.
<a id="OAuth2-accessCode"></a>
#### OAuth2 accessCode


- **Type**: OAuth
- **Flow**: accessCode
- **Authorization URL**: https://auth.barndoor.ai/realms/barndoor/protocol/openid-connect/auth
- **Scopes**: 
  - `openid`: Issue an OIDC ID token identifying the caller.
  - `profile`: Read the caller\&#39;s basic profile claims.
  - `email`: Read the caller\&#39;s email address.
  - `offline_access`: Issue a refresh token. Optional — no operation requires it.

## About

This TypeScript SDK client supports the [Fetch API](https://fetch.spec.whatwg.org/)
and is automatically generated by the
[OpenAPI Generator](https://openapi-generator.tech) project:

- API version: `2.0.0`
- Package version: `2.0.0`
- Generator version: `7.25.0`
- Build package: `org.openapitools.codegen.languages.TypeScriptFetchClientCodegen`

The generated npm module supports the following:

- Environments
  * Node.js
  * Webpack
  * Browserify
- Language levels
  * ES5 - you must have a Promises/A+ library installed
  * ES6
- Module systems
  * CommonJS
  * ES6 module system


## Development

### Building

To build the TypeScript source code, you need to have Node.js and npm installed.
After cloning the repository, navigate to the project directory and run:

```bash
npm install
npm run build
```

### Publishing

Once you've built the package, you can publish it to npm:

```bash
npm publish
```

## License

[]()
