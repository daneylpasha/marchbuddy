declare module 'react-native-keyboard-aware-scrollview' {
  import { ComponentType, RefObject } from 'react';
  import { ScrollViewProps, TextInput } from 'react-native';

  interface KeyboardAwareScrollViewProps extends ScrollViewProps {
    getTextInputRefs?: () => (TextInput | null)[];
    scrollToInputAdditionalOffset?: number;
    startScrolledToBottom?: boolean;
    scrollToBottomOnKBShow?: boolean;
  }

  export const KeyboardAwareScrollView: ComponentType<KeyboardAwareScrollViewProps>;
  export const KeyboardAwareListView: ComponentType<any>;
}
