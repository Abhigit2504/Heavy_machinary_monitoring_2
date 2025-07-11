// TextOverride.js
import { Text as RNText } from 'react-native';
import React from 'react';

const oldRender = RNText.render;

RNText.render = function (...args) {
  const origin = oldRender.call(this, ...args);
  return React.cloneElement(origin, {
    style: [{ fontFamily: 'BitcountGridDouble' }, origin.props.style],
  });
};
