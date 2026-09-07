/** iOS 18+ requires banner/list; shouldShowAlert alone can throw in expo-notifications 0.29. */
export function notificationHandlerBehavior() {
  return {
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  };
}
