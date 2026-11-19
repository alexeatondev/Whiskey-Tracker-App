// From the "AppConfig" output of the second-pour-sync stack (infra/second-pour-sync.yaml),
// Second Pour AWS account, us-east-2. These are identifiers, not secrets: access is controlled by
// Cognito sign-in and the IAM role, which only reaches the signed-in user's own folder.
// Set to null to hide cloud sync.
export const AWS_CONFIG = {
  region: 'us-east-2',
  userPoolId: 'us-east-2_zfz9Uq3Nv',
  clientId: '1usjfq7mfkjcr3l1ko6mgdglbf',
  domain: 'https://secondpour-884725728481.auth.us-east-2.amazoncognito.com',
  identityPoolId: 'us-east-2:136ef27b-b2b6-469c-9ed9-ef688ba44f46',
  bucket: 'secondpour-sync-884725728481',
  aiUrl: 'https://vbr3p3hkk6ql65h4tt6yzpwr540jjkyw.lambda-url.us-east-2.on.aws/',
};
