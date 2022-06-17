/* globals zoomSdk */
import { useEffect, useCallback, useState } from "react";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import "bootstrap/dist/css/bootstrap.min.css";

function Auth0User(props) {
  const [thirdPartyUser, setThirdPartyUser] = useState(null);
  const [isLoadingAuth0, setIsLoadingAuth0] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    async function getUserProfile() {
      const userDataResponse = await fetch(
        `${process.env.REACT_APP_PUBLIC_ROOT}/api/auth0/proxy/userinfo`
      );

      if (userDataResponse.ok && userDataResponse.status === 200) {
        const userData = await userDataResponse.json();
        setThirdPartyUser(userData);
      } else {
        console.log(userDataResponse)
        console.log('Request to Auth0 API has failed ^, likely because no Auth0 access token exists for this user. You must click Login to authenticate to 3rd party')
      }
      setIsLoadingAuth0(false);
    }
    getUserProfile();
  }, [props.user]);

  const thirdPartyInstall = async () => {
    setIsLoggingIn(true);
    zoomSdk.openUrl({
      url: `${process.env.REACT_APP_PUBLIC_ROOT}/api/auth0/login`,
    });
    setTimeout(() => setIsLoggingIn(false), 3000);
  };

  const thirdPartyLogout = useCallback(() => {
    setIsLoadingAuth0(true);
    fetch(`${process.env.REACT_APP_PUBLIC_ROOT}/api/auth0/logout`)
      .then(() => {
        setIsLoadingAuth0(false);
        setThirdPartyUser(null);
      })
      .catch((error) => {
        setIsLoadingAuth0(false);
        console.error(error);
        //setError(error);
      });
  }, []);

  const isMissingAuthVariables =
    !process.env.REACT_APP_AUTH0_CLIENT_ID ||
    !process.env.REACT_APP_AUTH0_ISSUER_BASE_URL ||
    !process.env.REACT_APP_AUTH0_CLIENT_SECRET;

  return (
    <div>
      <pre>
        {isLoadingAuth0 ? (
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        ) : thirdPartyUser ? (
          <div>
            <div style={{ display: "inline-block" }}>
              {JSON.stringify(
                thirdPartyUser,
                <Button
                  variant="primary"
                  disabled={isMissingAuthVariables}
                  onClick={thirdPartyInstall}
                >
                  Please Login
                </Button>,
                2
              )}
            </div>
            <Button
              style={{ marginTop: "15px", float: "right" }}
              variant="danger"
              onClick={thirdPartyLogout}
            >
              Logout
            </Button>
          </div>
        ) : (
          <>
            {isMissingAuthVariables && (
              <Alert variant="warning">Missing Auth0 env variables</Alert>
            )}
            <Button
              variant="primary"
              disabled={isLoggingIn || isMissingAuthVariables}
              onClick={isLoggingIn ? null : thirdPartyInstall}
            >
              {isLoggingIn ? "Logging in..." : "Please Login"}
            </Button>
          </>
        )}
      </pre>
    </div>
  );
}

export default Auth0User;
