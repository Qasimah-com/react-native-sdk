import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type OpenOptions = {
  presentation: string;
  language?: string;
  callbackScheme?: string;
  callbackHost?: string;
  callbackPath?: string;
};

export type OpenOutcome = {
  dismissed: boolean;
  url?: string;
};

export interface Spec extends TurboModule {
  open(paymentUrl: string, options: OpenOptions): Promise<OpenOutcome>;
  close(): Promise<void>;
}

export const MODULE_NAME = 'QasimhaCheckout';

export default TurboModuleRegistry.get<Spec>(MODULE_NAME);
