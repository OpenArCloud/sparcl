/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

import type { Mesh } from 'ogl';
import type ogl from './engines/ogl/ogl';

/*
    Class to handle the definitions added to the content record for an entry of type placeholder.
 */

// definition property isn't yet added to the scr definition. Use this as stand in until it's done
// https://github.com/OpenArCloud/oscp-spatial-content-discovery/issues/19
const definition = [
    {
        key: 'value', // or a more descriptive format when needed
        color: '0.5, 1, 0', // For example
    },
];

/**
 * Interpret and apply the provided definitions to the provided placeholder object.
 *
 * @param tdEngine  OGL     3D engine used by sparcl
 * @param placeholder  Mesh     3D object to apply the definitions to
 * @param definitions  String       The definitions to apply
 */
export function handlePlaceholderDefinitions(tdEngine: ogl, placeholder: Mesh, definitions?: string) {}
