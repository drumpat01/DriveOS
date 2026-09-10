import React from 'react';
export const touchFeedbackMock = {
  TouchPressable: ({ children, ...props }: any) => React.createElement('Pressable', props, children),
  SlidingSelection: ({ children, style, itemStyle }: any) => React.createElement('View', { style }, React.Children.map(children, child => React.createElement('View', { style: itemStyle, testID: 'selection-item' }, child))),
  ExpandingSection: ({ children, expanded }: any) => expanded ? React.createElement('View', {}, children) : null,
};
