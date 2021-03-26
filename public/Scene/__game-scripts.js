var ColorEvent = pc.createScript("colorEvent");
ColorEvent.attributes.add("eventName", {
    type: "string",
    title: "Event Name"
})

ColorEvent.attributes.add("color", {type: "rgba", title: "Color"})

ColorEvent.prototype.initialize = function () {
    this.entity.button.on("click", (function () {
        console.log('fire setcolor');

        this.app.fire(this.eventName, this.color)
    }), this)
};



var NumberEvent = pc.createScript("numberEvent");
NumberEvent.attributes.add("eventName", {
    type: "string",
    title: "Event Name"
})

NumberEvent.attributes.add("number", {
    type: "number",
    title: "Number"
})

NumberEvent.prototype.initialize = function () {
    this.entity.button.on("click", (function () {
        console.log('fire setrotation');

        this.app.fire(this.eventName, this.number)
    }), this)
};



var Cube = pc.createScript("cube");
Cube.prototype.initialize = function () {
    this.rotateSpeed = 0;

    this.app.on("setrotation", (function (t) {
        this.rotateSpeed = t;
    }), this)

    this.app.on("setcolor", (function (t) {
        this.entity.model.meshInstances.forEach((function (e) {
            e.material.diffuse.copy(t);
            e.material.update();
        }))
    }), this)
}

Cube.prototype.update = function (t) {
    this.entity.rotate(0, this.rotateSpeed * t, 0);
};
