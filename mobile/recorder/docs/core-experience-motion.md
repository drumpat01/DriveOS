# Core experience motion

The central motion loop is Home portal → confirmed recorder start → live journey data → confirmed local save → journey card → native detail transition.

- The Home portal gives short press feedback; recorder-state haptics occur only after native/local operations succeed.
- Recorder and Live polling pause while JourneyDeck is inactive without stopping the native background recorder.
- Live metric movement is driven only by real local timestamps and GPS points.
- Existing Expo Router Apple Zoom links own journey-card detail transitions and the return gesture.
- Reduce Motion settles press/data transitions immediately; the shared foundation controls app lifecycle.
- Do not add fake telemetry, perpetual portal pulsing, camera resets, or screen-local accessibility/AppState subscriptions.
