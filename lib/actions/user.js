import { createAction } from 'redux-actions'

import { fetchUser } from '../util/middleware'

export const settingCurrentUser = createAction('SET_CURRENT_USER')

export function setCurrentUser (user, accessToken) {
  return function (dispatch, getState) {
    dispatch(settingCurrentUser({ accessToken, user }))
  }
}

function getStateForNewUser (auth0User) {
  return {
    auth0UserId: auth0User.sub,
    email: auth0User.email,
    hasConsentedToTerms: false, // User must agree to terms.
    isEmailVerified: auth0User.email_verified,
    notificationChannel: 'email',
    phoneNumber: '',
    recentLocations: [],
    savedLocations: [],
    storeTripHistory: false // User must opt in.
  }
}

/**
 * Fetches user preferences or set initial values under state.otpUser if no user has been loaded.
 */
export function ensureLoggedInUserIsFetched (auth) {
  return async function (dispatch, getState) {
    const { otp, otpUser } = getState()
    const { loggedInUser } = otpUser

    if (auth && !loggedInUser) {
      const { accessToken, user } = auth
      if (accessToken) {
        try {
          const result = await fetchUser(
            otp.config.persistence.otp_middleware,
            accessToken,
            user.sub
          )

          // Beware! On AWS, for a nonexistent user, the call above will return, for example:
          // {
          //    status: 'success',
          //    data: {
          //      "result": "ERR",
          //      "message": "No user with auth0UserId=000000 found.",
          //      "code": 404,
          //      "detail": null
          //    }
          // }
          //
          // On direct middleware interface, for a nonexistent user, the call above will return:
          // {
          //    status: 'error',
          //    message: 'Error get-ing user...'
          // }
          // TODO: Improve AWS response.

          const resultData = result.data
          const isNewAccount = result.status === 'error' || (resultData && resultData.result === 'ERR')

          if (!isNewAccount) {
            // TODO: Move next line somewhere else.
            if (resultData.savedLocations === null) resultData.savedLocations = []
            dispatch(settingCurrentUser({ accessToken, user: resultData }))
          } else {
            dispatch(settingCurrentUser({ accessToken, user: getStateForNewUser(auth.user) }))
          }
        } catch (error) {
          // TODO: improve error handling.
          alert(`An error was encountered:\n${error}`)
        }
      }
    }
  }
}