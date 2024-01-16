/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

import chai from 'chai';
import { calculateLocalLocation } from '../../src/core/locationTools';

const expect = chai.expect;


describe('LocationTools', () => {
    describe('relative distance', () => {
        it('expect []', () => {
            const from = { latitude: 50.06632, longitude: -5.71475 };
            const to = { latitude: 58.64402, longitude: -3.07009 };
            const localLocation = calculateLocalLocation(from, to);

            expect(localLocation).to.be.a('object').and.eql({x:957633.7550720829, y:0, z:-154106.05207874667});
        });
    });
});
