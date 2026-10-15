#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(QasimhaCheckout, NSObject)

RCT_EXTERN_METHOD(open:(NSString *)paymentUrl
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(close:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
