/* globals zoomSdk */
import React, { useEffect, useState } from "react";
import { Route, Redirect, useLocation } from "react-router-dom";
import Button from "react-bootstrap/Button";
import Auth0User from "./Auth0User";
import Header from "./Header";
import IFrame from "./IFrame";
import Image from "./Image";
import UserInfo from "./UserInfo";

export const Authorization = (props) => {
  const {
    handleError,
    handleUser,
    handleUserContextStatus,
    user,
    userContextStatus,
  } = props;
  const location = useLocation();
  const [userAuthorized, setUserAuthorized] = useState(null);
  const [showInClientOAuthPrompt, setShowInClientOAuthPrompt] = useState(false);
  const [inGuestMode, setInGuestMode] = useState(false);

  const promptAuthorize = async () => {
    try {
      const promptAuthResponse = await zoomSdk.promptAuthorize();
      console.log(promptAuthResponse);
    } catch (e) {
      console.error(e);
    }
  };

  const authorize = async () => {
    setShowInClientOAuthPrompt(false);
    console.log("Authorize flow begins here");
    console.log("1. Get code challenge and state from backend . . .");
    let authorizeResponse;
    try {
      authorizeResponse = await (await fetch("/api/zoomapp/authorize")).json();
      console.log(authorizeResponse);
      if (!authorizeResponse || !authorizeResponse.codeChallenge) {
        console.error(
          "Error in the authorize flow - likely an outdated user session.  Please refresh the app"
        );
        setShowInClientOAuthPrompt(true);
        return;
      }
    } catch (e) {
      console.error(e);
    }
    const { codeChallenge, state } = authorizeResponse;

    console.log("1a. Code challenge from backend: ", codeChallenge);
    console.log("1b. State from backend: ", state);

    const authorizeOptions = {
      codeChallenge: codeChallenge,
      state: state,
    };
    console.log("2. Invoke authorize, eg zoomSdk.authorize(authorizeOptions)");
    try {
      const zoomAuthResponse = await zoomSdk.authorize(authorizeOptions);
      console.log(zoomAuthResponse);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // this is not the best way to make sure > 1 instances are not registered
    console.log("In-Client OAuth flow: onAuthorized event listener added");
    zoomSdk.addEventListener("onAuthorized", (event) => {
      const { code, state } = event;
      console.log("3. onAuthorized event fired.");
      console.log(
        "3a. Here is the event passed to event listener callback, with code and state: ",
        event
      );
      console.log(
        "4. POST the code, state to backend to exchange server-side for a token.  Refer to backend logs now . . ."
      );

      fetch("/api/zoomapp/onauthorized", {
        method: "POST",
        body: JSON.stringify({
          code,
          state,
          href: window.location.href,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }).then(() => {
        console.log(
          "4. Backend returns succesfully after exchanging code for auth token.  Go ahead and update the UI"
        );
        setUserAuthorized(true);

        // the error === string
        handleError(null);
      });
    });
  }, [handleError]);

  useEffect(() => {
    zoomSdk.addEventListener("onMyUserContextChange", (event) => {
      handleUserContextStatus(event.status);
    });
    async function fetchUser() {
      try {
        // An example of using the Zoom REST API via proxy
        const response = await fetch("/zoom/api/v2/users/me");
        if (response.status !== 200) throw new Error();
        const user = await response.json();
        handleUser(user);
        setShowInClientOAuthPrompt(false);
      } catch (error) {
        console.error(error);
        console.log(
          "Request to Zoom REST API has failed ^, likely because no Zoom access token exists for this user. You must use the authorize API to get an access token"
        );
        setShowInClientOAuthPrompt(true);
        // setError("There was an error getting your user information");
      }
    }

    if (userContextStatus === "authorized") {
      setInGuestMode(false);
      fetchUser();
    } else if (
      userContextStatus === "unauthenticated" ||
      userContextStatus === "authenticated"
    ) {
      setInGuestMode(true);
    }
  }, [handleUser, handleUserContextStatus, userAuthorized, userContextStatus]);

  return (
    <>
      <p>You are on this route: {location.pathname}</p>

      {!inGuestMode && <Button
        variant="primary"
        onClick={inGuestMode ? promptAuthorize : authorize}
      >
        {inGuestMode ? "promptAuthorize" : "authorize"}
      </Button>}

      <div>
        <Header
          navLinks={{ userInfo: "User Info", iframe: "IFrame", image: "Image" }}
        />
        <Route path="" exact>
          <Redirect to="/userinfo" />
        </Route>
        <Route path="/userinfo">

          <UserInfo
            user={user}
            onClick={inGuestMode ? promptAuthorize : authorize}
            showGuestModePrompt={inGuestMode}
            userContextStatus={userContextStatus}
            showInClientOAuthPrompt={showInClientOAuthPrompt}
          />
        </Route>
        <Route path="/image">
          <Image />
        </Route>
        <Route path="/iframe">
          <IFrame />
        </Route>
      </div>
      <Header navLinks={{ auth0Data: "Auth0 User Data" }} />
      <Auth0User user={user} />
    </>
  );
};
