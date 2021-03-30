/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE for details)
*/

/* Provides models for generic content, provided by the content discovery */

import "@thirdparty/playcanvas.min.js";


/**
 * Simple sample model to place for tests.
 *
 * @param type  String      One of the supported object types
 * @param color  Color      Playcanvas color object
 * @returns {Entity}
 */
export function createModel(type = 'box', color) {
    const entity = new pc.Entity();
    entity.addComponent("model", {type: type});
    entity.setLocalScale(0.1, 0.1, 0.1);
    entity.setLocalPosition(-0.25, 0.0, 0.0);

    if (color) {
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.update();

        entity.model.material = material;
    }

    return entity;
}


/**
 * Creates a model for content type 'placeholder', based on optionally provided keywords.
 *
 * Positioning of the model needs to be done by the caller.
 *
 * @param keywords      string, provided by a call to a Spatial Content Discovery server
 * @returns {Entity}
 */
export function createPlaceholder(keywords) {
    const placeholder = createModel('sphere');
    placeholder.setLocalScale(.5, .5, .5);
    return placeholder;
}


/**
 * Add axes at the zero point of the local coordinate system.
 *
 * @returns {Entity}
 */
export function createAxes() {
    const entity = new pc.Entity();

    // add something small at the positive X, Y, Z:
    const objX = createModel("box", new pc.Color(1, 0, 0));
    objX.setPosition(1, 0, 0);
    entity.addChild(objX);

    const objY = createModel("sphere", new pc.Color(0, 1, 0));
    objY.setPosition(0, 1, 0);
    entity.addChild(objY);

    const objZ = createModel("cone", new pc.Color(0, 0, 1));
    objZ.setPosition(0, 0, 1);
    entity.addChild(objZ);

    const obj0 = createModel("box", new pc.Color(1, 0, 0));
    obj0.setLocalScale(0.01, 0.01, 0.01);
    obj0.setPosition(0, 0, 0);
    entity.addChild(obj0);

    return entity;
}
