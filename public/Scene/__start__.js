(function () {

    var configure = function () {
        app.configure(CONFIG_FILENAME, function (err) {
            if (err) {
                console.error(err);
            }

            // do the first reflow after a timeout because of
            // iOS showing a squished iframe sometimes
            setTimeout(function () {

                app.preload(function (err) {
                    if (err) {
                        console.error(err);
                    }

                    app.loadScene(SCENE_PATH, function (err, scene) {
                        if (err) {
                            console.error(err);
                        }

                        const sceneRoot = app.root.findByName('playcanvasparent');
                        scene.root.reparent(sceneRoot);

                        app.start();
                    });
                });
            });
        });
    };

    if (PRELOAD_MODULES.length > 0) {
        loadModules(PRELOAD_MODULES, ASSET_PREFIX, configure);
    } else {
        configure();
    }
})();
