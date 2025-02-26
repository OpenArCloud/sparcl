/*
  (c) 2025 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import { navigate } from 'svelte-routing';
import { isAuthenticatedAuth0, popupOpen, showLogin, showDashboard, isLoggedIn, currentLoggedInUser } from "../stateStore.js";

/////////////////////////////////// Auth0 Configuration  ///////////////////////////////////

// @ts-ignore
async function loginWithPopup(client, options) {
  popupOpen.set(true);

  try {
    await client.loginWithPopup(options);

    const userData = await client.getUser();

    const userDetails = {
      email: userData.email,
      username: userData.given_name
  };

    // Save User Details: Convert the object to a JSON string
    const userDetailsString = JSON.stringify(userDetails);
    currentLoggedInUser.set(userDetailsString);

    // set Main User Flags
    isAuthenticatedAuth0.set(true);
    isLoggedIn.set(true);
    showLogin.set(false);
    showDashboard.set(true);

     // save isAuthenticatedAuth0 to the localstorage to help figure out login type
     localStorage.setItem('isAuthenticatedAuth0', JSON.stringify(true));

    let link = import.meta.env.VITE_AUTH_REDIRECT_URI ?? window.location.origin
    navigate(link);

  } catch (e) {
    // eslint-disable-next-line
    console.error(e);
  } finally {
    popupOpen.set(false);
  }
}

// @ts-ignore
function logoutAuth0(client) {
  localStorage.removeItem('isAuthenticatedAuth0');
  localStorage.removeItem('auth0Client');

  return client.logout();
}

const auth0 = {
  loginWithPopup,
  logoutAuth0
};

export default auth0;
