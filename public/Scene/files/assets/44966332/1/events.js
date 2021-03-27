var ColorEvent = pc.createScript('colorEvent');

ColorEvent.attributes.add('eventName', { type: 'string', title: 'Event Name' });
ColorEvent.attributes.add('color', { type: 'rgba', title: 'Color' });

ColorEvent.prototype.initialize = function() {
    this.entity.button.on('click', function () {
        this.app.fire(`send:${this.eventName}`, this.color);
    }, this);
};

var NumberEvent = pc.createScript('numberEvent');

NumberEvent.attributes.add('eventName', { type: 'string', title: 'Event Name' });
NumberEvent.attributes.add('number', { type: 'number', title: 'Number' });

NumberEvent.prototype.initialize = function() {
    this.entity.button.on('click', function () {
        this.app.fire(`send:${this.eventName}`, this.number);
    }, this);
};
