import { isNativeStoreApp } from './nativePlatform';

// App das lojas (Google Play e App Store): nenhuma tela diz para assinar, pagar ou
// ativar o Pro, nem mostra preco ou forma de pagamento, porque a compra so existe
// no site. As politicas de pagamento das duas lojas proibem levar o usuario a pagar
// fora do faturamento delas. O APK baixado do site e o mesmo build e segue a regra.
export const STORE_PLAN_LINK_LABEL = 'Ver meu plano';

export function planLinkLabel(webLabel, storeApp = isNativeStoreApp()) {
  return storeApp ? STORE_PLAN_LINK_LABEL : webLabel;
}
