import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { AWS_CONFIG } from './config.js';

export const cognitoClient = new CognitoIdentityProviderClient({
  region: AWS_CONFIG.region,
});

/**
 * Sign up a user in Amazon Cognito User Pool (AWS Free Tier: 50,000 MAU free forever).
 */
export async function signUpWithCognito(
  email: string,
  password: string,
  phone?: string,
  name?: string
) {
  if (!AWS_CONFIG.cognito.clientId) {
    throw new Error('COGNITO_CLIENT_ID is not configured');
  }

  const userAttributes = [
    { Name: 'email', Value: email },
  ];
  if (phone) {
    userAttributes.push({ Name: 'phone_number', Value: phone });
  }
  if (name) {
    userAttributes.push({ Name: 'name', Value: name });
  }

  const command = new SignUpCommand({
    ClientId: AWS_CONFIG.cognito.clientId,
    Username: email,
    Password: password,
    UserAttributes: userAttributes,
  });

  return await cognitoClient.send(command);
}

/**
 * Confirm user signup with SMS or Email code in Amazon Cognito.
 */
export async function confirmCognitoUser(email: string, code: string) {
  if (!AWS_CONFIG.cognito.clientId) {
    throw new Error('COGNITO_CLIENT_ID is not configured');
  }

  const command = new ConfirmSignUpCommand({
    ClientId: AWS_CONFIG.cognito.clientId,
    Username: email,
    ConfirmationCode: code,
  });

  return await cognitoClient.send(command);
}

/**
 * Authenticate user with Amazon Cognito (USER_PASSWORD_AUTH flow).
 */
export async function loginWithCognito(email: string, password: string) {
  if (!AWS_CONFIG.cognito.clientId) {
    throw new Error('COGNITO_CLIENT_ID is not configured');
  }

  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: AWS_CONFIG.cognito.clientId,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });

  const response = await cognitoClient.send(command);
  return {
    accessToken: response.AuthenticationResult?.AccessToken,
    idToken: response.AuthenticationResult?.IdToken,
    refreshToken: response.AuthenticationResult?.RefreshToken,
    expiresIn: response.AuthenticationResult?.ExpiresIn,
  };
}

/**
 * Verify Cognito Access Token by fetching user attributes from AWS.
 */
export async function verifyCognitoAccessToken(accessToken: string) {
  try {
    const command = new GetUserCommand({
      AccessToken: accessToken,
    });
    const result = await cognitoClient.send(command);
    const emailAttr = result.UserAttributes?.find((a) => a.Name === 'email');
    return {
      username: result.Username,
      email: emailAttr ? emailAttr.Value : result.Username,
      attributes: result.UserAttributes,
    };
  } catch (err) {
    return null;
  }
}
