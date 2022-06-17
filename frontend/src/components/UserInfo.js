import Button from "react-bootstrap/Button";

function UserInfo(props) {
  const {
    user,
    showInClientOAuthPrompt,
    showGuestModePrompt,
    onClick,
    userContextStatus,
  } = props;

  if (showInClientOAuthPrompt) {
    // no user and not waiting for in-client authorize to complete
    return (
      <>
        <h1>
          You are in In-client Add
        </h1>
        <p>
          User has authorized your app and added.  But the app does not know this/ does not have have REST API access token.  Click here to invoke the authorize API, perform 'In-client OAuth' and
          receive/save access token for this user
        </p>
        <p>
        (If you've called this API before . . . you may be seeing this because your embedded
        browser session expired or was forgotten during a Docker restart.
        Please try closing and reoping, or re-installing the application)
        </p>
        <Button variant="primary" onClick={onClick}>
          authorize
        </Button>
      </>
    );
  } else if (showGuestModePrompt) {
    let bodyText;
    if (userContextStatus === "unauthenticated")
      bodyText =
        "This user is unauthenticated. Zoom does not know the user, and only some Zoom App APIs are allowed.  Invoking promptAuthorize will ask the user to log in to Zoom";
    else if (userContextStatus === "authenticated")
      bodyText =
        "This user is authenticated, but they have not yet added the app and/or consented to app scopes.  Invoke promptAuthorize once more to ask the authenticated user to consent and add the app (this will invoke the In-client OAuth flow).";
    return (
      <>
        <h1>You are in Guest Mode</h1>
        <p>{bodyText}</p>
        <p>Not all APIs will be available in Guest Mode</p>
        <Button onClick={onClick}>promptAuthorize</Button>
      </>
    );
  } else if (!user) {
    // loading user (first attempt to fetch user will fail if no access token/ in-client add)
    return <p>Loading Zoom User . . .</p>;
  }

  return (
    <div>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </div>
  );
}

export default UserInfo;
