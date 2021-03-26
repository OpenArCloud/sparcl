var Cube = pc.createScript('cube');

Cube.prototype.initialize = function() {
    this.rotateSpeed = 0;
    this.app.on('setrotation', function (speed) {
        this.rotateSpeed = speed;
    }, this);

    this.app.on('setcolor', function (color) {
        this.entity.model.meshInstances.forEach(function (meshInstance) {
            meshInstance.material.diffuse.copy(color);
            meshInstance.material.update();
        });
    }, this);
};

Cube.prototype.update = function(dt) {
    this.entity.rotate(0, this.rotateSpeed * dt, 0);
};