- [ ] privy server is down, ready=false, show Error on Dashboard UI
- [ ] refresh token if server says expired
- [ ] [refresh token](https://docs.privy.io/guide/react/authorization#managing-expired-access-tokens) before every api request (background can not call `getAccessToken()` )
- [ ] get token and refresh token in ext background
- [ ] re-login if user token is logout (can `getAccessToken()` auto handle it?)
- [ ] https://docs.privy.io/guide/expo/misc/persistence  expo custom token storage
