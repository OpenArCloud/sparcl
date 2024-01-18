<script>
    // ---------------------------------------------------------- UTILITY FUNCTIONS

    /** Creates a DOM element
     * @param type The type of the element (its tag name)
     * @param id The id of the element.
     * @param classes The classes of the element.
     * @param parent The parent of the element.
     * @param content The HTML content of the element.
     * @param style The style of the element.
     * @returns The generated element. */
    function createDomElement(type, id, parent, content, classes, style) {
        // Check if the element already exists and, if not, create it
        let element = document.getElementById(id);
        if (element) return element;
        element = document.createElement(type);

        // Set the properties of the element
        if (id) element.id = id;
        if (classes) element.className = classes;
        if (style) element.style.cssText = style;
        if (content) element.innerHTML = content;

        // Set the parent of element
        (parent ? parent : document.body).appendChild(element);

        // Return the generated element
        return element;
    }

    /** Creates a CSS rule.
     * @param selector The CSS selector
     * @param rule The css rule
     * @param override Indicates whether to override rules or not. */
    function addCssRule(selector, rule, override = false) {
        // If there is no stylesheet, create it
        if (document.styleSheets.length == 0) document.head.append(document.createElement('style'));
        let stylesheet = document.styleSheets[0];

        // Check if the rule exists
        let rules = stylesheet.cssRules,
            ruleIndex,
            ruleCount = rules.length;
        for (let ruleIndex = 0; ruleIndex < ruleCount; ruleIndex++) {
            if (rules[ruleIndex].cssText.startsWith(selector)) {
                if (override) rules[ruleIndex].cssText = selector + ' {' + rule + '}';
                else return;
            }
        }

        // If no rule was fond, create i and add it at the end
        stylesheet.insertRule(selector + ' {' + rule + '}', ruleCount);
    }

    // -------------------------------------------------------------------- GEOPOSE

    /** Defines a basic GeoPose with orientation angles. */
    class GeoPose {
        constructor(latitude = 0, longitude = 0, altitude = 0, yaw = 0, pitch = 0, roll = 0) {
            this.latitude = latitude;
            this.longitude = longitude;
            this.altitude = altitude;
            this.yaw = yaw;
            this.pitch = pitch;
            this.roll = roll;
        }
    }

    // Create an instance of the GeoPose class
    let geopose = new GeoPose();

    // Obtain the camera location using the GeoLocation API
    // See: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition((data) => {
            geopose.latitude = data.coords.latitude;
            geopose.longitude = data.coords.longitude;
            geopose.altitude = data.coords.altitude;
            // TODO Adjust the altitude to the WPS84 ellipsoid instead of sea level
            // TODO Check other methods to calculate the height over ellipsoid
            // See https://nextnav.com/
        });
    } else throw Error('Unable to obtain the camera location');

    // Obtain the camera orientation using the DeviceOrientationEvent API
    // See: https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent
    if (window.DeviceOrientationEvent) {
        window.addEventListener(
            'deviceorientation',
            function (data) {
                geopose.yaw = data.alpha + yawOffset;
                geopose.pitch = data.beta - 90;
                geopose.roll = data.gamma;
            },
            true,
        );
    } else throw Error('Unable to obtain camera orientation');

    // Create an offset value for the yaw orientation to point to the north in case
    // the magnetometer doesn't work
    let yawOffset = 0;

    // ------------------------------------------------------------------ FONT DATA

    // Since Svelte doesnt allow referencing sternal JSONs easily, I had to
    // embed the data here
    let fontData = {
        glyphs: {
            '0': {
                x_min: 51,
                x_max: 779,
                ha: 828,
                o: 'm 415 -26 q 142 129 242 -26 q 51 476 51 271 q 141 825 51 683 q 415 984 242 984 q 687 825 585 984 q 779 476 779 682 q 688 131 779 271 q 415 -26 587 -26 m 415 137 q 529 242 485 137 q 568 477 568 338 q 530 713 568 619 q 415 821 488 821 q 303 718 344 821 q 262 477 262 616 q 301 237 262 337 q 415 137 341 137 ',
            },
            '1': { x_min: 197.609375, x_max: 628, ha: 828, o: 'm 628 0 l 434 0 l 434 674 l 197 674 l 197 810 q 373 837 318 810 q 468 984 450 876 l 628 984 l 628 0 ' },
            '2': {
                x_min: 64,
                x_max: 764,
                ha: 828,
                o: 'm 764 685 q 675 452 764 541 q 484 325 637 415 q 307 168 357 250 l 754 168 l 754 0 l 64 0 q 193 301 64 175 q 433 480 202 311 q 564 673 564 576 q 519 780 564 737 q 416 824 475 824 q 318 780 358 824 q 262 633 270 730 l 80 633 q 184 903 80 807 q 415 988 276 988 q 654 907 552 988 q 764 685 764 819 ',
            },
            '3': {
                x_min: 61,
                x_max: 767,
                ha: 828,
                o: 'm 767 290 q 653 51 767 143 q 402 -32 548 -32 q 168 48 262 -32 q 61 300 61 140 l 250 300 q 298 173 250 219 q 405 132 343 132 q 514 169 471 132 q 563 282 563 211 q 491 405 563 369 q 343 432 439 432 l 343 568 q 472 592 425 568 q 534 701 534 626 q 493 793 534 758 q 398 829 453 829 q 306 789 344 829 q 268 669 268 749 l 80 669 q 182 909 80 823 q 410 986 274 986 q 633 916 540 986 q 735 719 735 840 q 703 608 735 656 q 615 522 672 561 q 727 427 687 486 q 767 290 767 369 ',
            },
            '4': {
                x_min: 53,
                x_max: 775.21875,
                ha: 828,
                o: 'm 775 213 l 660 213 l 660 0 l 470 0 l 470 213 l 53 213 l 53 384 l 416 958 l 660 958 l 660 370 l 775 370 l 775 213 m 474 364 l 474 786 l 204 363 l 474 364 ',
            },
            '5': {
                x_min: 59,
                x_max: 767,
                ha: 828,
                o: 'm 767 319 q 644 59 767 158 q 382 -29 533 -29 q 158 43 247 -29 q 59 264 59 123 l 252 264 q 295 165 252 201 q 400 129 339 129 q 512 172 466 129 q 564 308 564 220 q 514 437 564 387 q 398 488 464 488 q 329 472 361 488 q 271 420 297 456 l 93 428 l 157 958 l 722 958 l 722 790 l 295 790 l 271 593 q 348 635 306 621 q 431 649 389 649 q 663 551 560 649 q 767 319 767 453 ',
            },
            '6': {
                x_min: 57,
                x_max: 771,
                ha: 828,
                o: 'm 744 734 l 544 734 q 500 802 533 776 q 425 828 466 828 q 315 769 359 828 q 264 571 264 701 q 451 638 343 638 q 691 537 602 638 q 771 315 771 449 q 683 79 771 176 q 420 -29 586 -29 q 134 123 227 -29 q 57 455 57 250 q 184 865 57 721 q 452 988 293 988 q 657 916 570 988 q 744 734 744 845 m 426 128 q 538 178 498 128 q 578 300 578 229 q 538 422 578 372 q 415 479 493 479 q 303 430 342 479 q 264 313 264 381 q 308 184 264 240 q 426 128 352 128 ',
            },
            '7': { x_min: 65.28125, x_max: 762.5, ha: 828, o: 'm 762 808 q 521 435 604 626 q 409 0 438 244 l 205 0 q 313 422 227 234 q 548 789 387 583 l 65 789 l 65 958 l 762 958 l 762 808 ' },
            '8': {
                x_min: 57,
                x_max: 770,
                ha: 828,
                o: 'm 625 516 q 733 416 697 477 q 770 284 770 355 q 675 69 770 161 q 415 -29 574 -29 q 145 65 244 -29 q 57 273 57 150 q 93 413 57 350 q 204 516 130 477 q 112 609 142 556 q 83 718 83 662 q 177 905 83 824 q 414 986 272 986 q 650 904 555 986 q 745 715 745 822 q 716 608 745 658 q 625 516 688 558 m 414 590 q 516 624 479 590 q 553 706 553 659 q 516 791 553 755 q 414 828 480 828 q 311 792 348 828 q 275 706 275 757 q 310 624 275 658 q 414 590 345 590 m 413 135 q 527 179 487 135 q 564 279 564 218 q 525 386 564 341 q 411 436 482 436 q 298 387 341 436 q 261 282 261 344 q 300 178 261 222 q 413 135 340 135 ',
            },
            '9': {
                x_min: 58,
                x_max: 769,
                ha: 828,
                o: 'm 769 492 q 646 90 769 232 q 384 -33 539 -33 q 187 35 271 -33 q 83 224 98 107 l 282 224 q 323 154 286 182 q 404 127 359 127 q 513 182 471 127 q 563 384 563 248 q 475 335 532 355 q 372 315 418 315 q 137 416 224 315 q 58 642 58 507 q 144 877 58 781 q 407 984 239 984 q 694 827 602 984 q 769 492 769 699 m 416 476 q 525 521 488 476 q 563 632 563 566 q 521 764 563 709 q 403 826 474 826 q 297 773 337 826 q 258 649 258 720 q 295 530 258 577 q 416 476 339 476 ',
            },

            A: { x_min: 0, x_max: 966.671875, ha: 1069, o: 'm 966 0 l 747 0 l 679 208 l 286 208 l 218 0 l 0 0 l 361 1013 l 600 1013 l 966 0 m 623 376 l 480 810 l 340 376 l 623 376 ' },
            B: {
                x_min: 0,
                x_max: 835,
                ha: 938,
                o: 'm 674 547 q 791 450 747 518 q 835 304 835 383 q 718 75 835 158 q 461 0 612 0 l 0 0 l 0 1013 l 477 1013 q 697 951 609 1013 q 797 754 797 880 q 765 630 797 686 q 674 547 734 575 m 438 621 q 538 646 495 621 q 590 730 590 676 q 537 814 590 785 q 436 838 494 838 l 199 838 l 199 621 l 438 621 m 445 182 q 561 211 513 182 q 618 311 618 247 q 565 410 618 375 q 444 446 512 446 l 199 446 l 199 182 l 445 182 ',
            },
            C: {
                x_min: 0,
                x_max: 970.828125,
                ha: 1043,
                o: 'm 970 345 q 802 70 933 169 q 490 -29 672 -29 q 130 130 268 -29 q 0 506 0 281 q 134 885 0 737 q 502 1040 275 1040 q 802 939 668 1040 q 965 679 936 838 l 745 679 q 649 809 716 761 q 495 857 582 857 q 283 747 361 857 q 214 508 214 648 q 282 267 214 367 q 493 154 359 154 q 651 204 584 154 q 752 345 718 255 l 970 345 ',
            },
            D: {
                x_min: 0,
                x_max: 864,
                ha: 968,
                o: 'm 400 1013 q 736 874 608 1013 q 864 523 864 735 q 717 146 864 293 q 340 0 570 0 l 0 0 l 0 1013 l 400 1013 m 398 837 l 206 837 l 206 182 l 372 182 q 584 276 507 182 q 657 504 657 365 q 594 727 657 632 q 398 837 522 837 ',
            },
            E: { x_min: 0, x_max: 761.109375, ha: 824, o: 'm 761 0 l 0 0 l 0 1013 l 734 1013 l 734 837 l 206 837 l 206 621 l 690 621 l 690 446 l 206 446 l 206 186 l 761 186 l 761 0 ' },
            F: { x_min: 0, x_max: 706.953125, ha: 778, o: 'm 706 837 l 206 837 l 206 606 l 645 606 l 645 431 l 206 431 l 206 0 l 0 0 l 0 1013 l 706 1013 l 706 837 ' },
            G: {
                x_min: 0,
                x_max: 971,
                ha: 1057,
                o: 'm 971 -1 l 829 -1 l 805 118 q 479 -29 670 -29 q 126 133 261 -29 q 0 509 0 286 q 130 884 0 737 q 493 1040 268 1040 q 790 948 659 1040 q 961 698 920 857 l 736 698 q 643 813 709 769 q 500 857 578 857 q 285 746 364 857 q 213 504 213 644 q 285 263 213 361 q 505 154 365 154 q 667 217 598 154 q 761 374 736 280 l 548 374 l 548 548 l 971 548 l 971 -1 ',
            },
            H: { x_min: 0, x_max: 838, ha: 953, o: 'm 838 0 l 628 0 l 628 450 l 210 450 l 210 0 l 0 0 l 0 1013 l 210 1013 l 210 635 l 628 635 l 628 1013 l 838 1013 l 838 0 ' },
            I: { x_min: 41, x_max: 249, ha: 365, o: 'm 249 0 l 41 0 l 41 1013 l 249 1013 l 249 0 ' },
            J: {
                x_min: 0,
                x_max: 649,
                ha: 760,
                o: 'm 649 294 q 573 48 649 125 q 327 -29 497 -29 q 61 82 136 -29 q 0 375 0 173 l 200 375 l 199 309 q 219 194 199 230 q 321 145 249 145 q 418 193 390 145 q 441 307 441 232 l 441 1013 l 649 1013 l 649 294 ',
            },
            K: { x_min: 0, x_max: 900, ha: 996, o: 'm 900 0 l 647 0 l 316 462 l 208 355 l 208 0 l 0 0 l 0 1013 l 208 1013 l 208 595 l 604 1013 l 863 1013 l 461 603 l 900 0 ' },
            L: { x_min: 0, x_max: 704.171875, ha: 763, o: 'm 704 0 l 0 0 l 0 1013 l 208 1013 l 208 186 l 704 186 l 704 0 ' },
            M: { x_min: 0, x_max: 1019, ha: 1135, o: 'm 1019 0 l 823 0 l 823 819 l 618 0 l 402 0 l 194 818 l 194 0 l 0 0 l 0 1013 l 309 1012 l 510 241 l 707 1013 l 1019 1013 l 1019 0 ' },
            N: { x_min: 0, x_max: 833, ha: 949, o: 'm 833 0 l 617 0 l 206 695 l 206 0 l 0 0 l 0 1013 l 216 1013 l 629 315 l 629 1013 l 833 1013 l 833 0 ' },
            O: {
                x_min: 0,
                x_max: 994,
                ha: 1094,
                o: 'm 497 -29 q 133 127 272 -29 q 0 505 0 277 q 131 883 0 733 q 497 1040 270 1040 q 860 883 721 1040 q 994 505 994 733 q 862 127 994 277 q 497 -29 723 -29 m 497 154 q 710 266 631 154 q 780 506 780 365 q 710 745 780 647 q 497 857 631 857 q 283 747 361 857 q 213 506 213 647 q 282 266 213 365 q 497 154 361 154 ',
            },
            P: {
                x_min: 0,
                x_max: 771,
                ha: 838,
                o: 'm 208 361 l 208 0 l 0 0 l 0 1013 l 450 1013 q 682 919 593 1013 q 771 682 771 826 q 687 452 771 544 q 466 361 604 361 l 208 361 m 421 837 l 208 837 l 208 544 l 410 544 q 525 579 480 544 q 571 683 571 615 q 527 792 571 747 q 421 837 484 837 ',
            },
            Q: {
                x_min: 0,
                x_max: 995.59375,
                ha: 1096,
                o: 'm 995 49 l 885 -70 l 762 42 q 641 -12 709 4 q 497 -29 572 -29 q 135 123 271 -29 q 0 504 0 276 q 131 881 0 731 q 497 1040 270 1040 q 859 883 719 1040 q 994 506 994 731 q 966 321 994 413 q 884 152 938 229 l 995 49 m 730 299 q 767 395 755 344 q 779 504 779 446 q 713 743 779 644 q 505 857 638 857 q 284 745 366 857 q 210 501 210 644 q 279 265 210 361 q 492 157 357 157 q 615 181 557 157 l 508 287 l 620 405 l 730 299 ',
            },
            R: {
                x_min: 0,
                x_max: 836.109375,
                ha: 947,
                o: 'm 836 0 l 608 0 q 588 53 596 20 q 581 144 581 86 q 581 179 581 162 q 581 215 581 197 q 553 345 581 306 q 428 393 518 393 l 208 393 l 208 0 l 0 0 l 0 1013 l 491 1013 q 720 944 630 1013 q 819 734 819 869 q 778 584 819 654 q 664 485 738 513 q 757 415 727 463 q 794 231 794 358 l 794 170 q 800 84 794 116 q 836 31 806 51 l 836 0 m 462 838 l 208 838 l 208 572 l 452 572 q 562 604 517 572 q 612 704 612 640 q 568 801 612 765 q 462 838 525 838 ',
            },
            S: {
                x_min: 0,
                x_max: 826,
                ha: 915,
                o: 'm 826 306 q 701 55 826 148 q 423 -29 587 -29 q 138 60 255 -29 q 0 318 13 154 l 208 318 q 288 192 216 238 q 437 152 352 152 q 559 181 506 152 q 623 282 623 217 q 466 411 623 372 q 176 487 197 478 q 18 719 18 557 q 136 958 18 869 q 399 1040 244 1040 q 670 956 561 1040 q 791 713 791 864 l 591 713 q 526 826 583 786 q 393 866 469 866 q 277 838 326 866 q 218 742 218 804 q 374 617 218 655 q 667 542 646 552 q 826 306 826 471 ',
            },
            T: { x_min: 0, x_max: 809, ha: 894, o: 'm 809 831 l 509 831 l 509 0 l 299 0 l 299 831 l 0 831 l 0 1013 l 809 1013 l 809 831 ' },
            U: {
                x_min: 0,
                x_max: 813,
                ha: 926,
                o: 'm 813 362 q 697 79 813 187 q 405 -29 582 -29 q 114 78 229 -29 q 0 362 0 186 l 0 1013 l 210 1013 l 210 387 q 260 226 210 291 q 408 154 315 154 q 554 226 500 154 q 603 387 603 291 l 603 1013 l 813 1013 l 813 362 ',
            },
            V: { x_min: 0, x_max: 895.828125, ha: 997, o: 'm 895 1013 l 550 0 l 347 0 l 0 1013 l 231 1013 l 447 256 l 666 1013 l 895 1013 ' },
            W: {
                x_min: 0,
                x_max: 1291.671875,
                ha: 1399,
                o: 'm 1291 1013 l 1002 0 l 802 0 l 645 777 l 490 0 l 288 0 l 0 1013 l 215 1013 l 388 298 l 534 1012 l 757 1013 l 904 299 l 1076 1013 l 1291 1013 ',
            },
            X: { x_min: 0, x_max: 894.453125, ha: 999, o: 'm 894 0 l 654 0 l 445 351 l 238 0 l 0 0 l 316 516 l 0 1013 l 238 1013 l 445 659 l 652 1013 l 894 1013 l 577 519 l 894 0 ' },
            Y: { x_min: 0, x_max: 836, ha: 931, o: 'm 836 1013 l 532 376 l 532 0 l 322 0 l 322 376 l 0 1013 l 208 1013 l 427 576 l 626 1013 l 836 1013 ' },
            Z: { x_min: 0, x_max: 804.171875, ha: 906, o: 'm 804 836 l 251 182 l 793 182 l 793 0 l 0 0 l 0 176 l 551 830 l 11 830 l 11 1013 l 804 1013 l 804 836 ' },

            a: {
                x_min: 0,
                x_max: 700,
                ha: 786,
                o: 'm 700 0 l 488 0 q 465 93 469 45 q 365 5 427 37 q 233 -26 303 -26 q 65 37 130 -26 q 0 205 0 101 q 120 409 0 355 q 343 452 168 431 q 465 522 465 468 q 424 588 465 565 q 337 611 384 611 q 250 581 285 611 q 215 503 215 552 l 26 503 q 113 707 26 633 q 328 775 194 775 q 538 723 444 775 q 657 554 657 659 l 657 137 q 666 73 657 101 q 700 33 675 45 l 700 0 m 465 297 l 465 367 q 299 322 358 340 q 193 217 193 287 q 223 150 193 174 q 298 127 254 127 q 417 175 370 127 q 465 297 465 224 ',
            },
            b: {
                x_min: 0,
                x_max: 722,
                ha: 822,
                o: 'm 416 -26 q 289 6 346 -26 q 192 101 232 39 l 192 0 l 0 0 l 0 1013 l 192 1013 l 192 656 q 286 743 226 712 q 415 775 346 775 q 649 644 564 775 q 722 374 722 533 q 649 106 722 218 q 416 -26 565 -26 m 361 600 q 232 524 279 600 q 192 371 192 459 q 229 221 192 284 q 357 145 275 145 q 487 221 441 145 q 526 374 526 285 q 488 523 526 460 q 361 600 442 600 ',
            },
            c: {
                x_min: 0,
                x_max: 751.390625,
                ha: 828,
                o: 'm 751 282 q 625 58 725 142 q 384 -26 526 -26 q 107 84 215 -26 q 0 366 0 195 q 98 651 0 536 q 370 774 204 774 q 616 700 518 774 q 751 486 715 626 l 536 486 q 477 570 516 538 q 380 607 434 607 q 248 533 298 607 q 204 378 204 466 q 242 219 204 285 q 377 139 290 139 q 483 179 438 139 q 543 282 527 220 l 751 282 ',
            },
            d: {
                x_min: 0,
                x_max: 722,
                ha: 836,
                o: 'm 722 0 l 530 0 l 530 101 q 303 -26 449 -26 q 72 103 155 -26 q 0 373 0 214 q 72 642 0 528 q 305 775 156 775 q 433 743 373 775 q 530 656 492 712 l 530 1013 l 722 1013 l 722 0 m 361 600 q 234 523 280 600 q 196 372 196 458 q 233 220 196 286 q 358 143 278 143 q 489 216 442 143 q 530 369 530 280 q 491 522 530 456 q 361 600 443 600 ',
            },
            e: {
                x_min: 0,
                x_max: 708,
                ha: 808,
                o: 'm 708 321 l 207 321 q 254 186 207 236 q 362 141 298 141 q 501 227 453 141 l 700 227 q 566 36 662 104 q 362 -26 477 -26 q 112 72 213 -26 q 0 369 0 182 q 95 683 0 573 q 358 793 191 793 q 619 677 531 793 q 708 321 708 561 m 501 453 q 460 571 501 531 q 353 612 420 612 q 247 570 287 612 q 207 453 207 529 l 501 453 ',
            },
            f: {
                x_min: 0,
                x_max: 424,
                ha: 525,
                o: 'm 424 609 l 300 609 l 300 0 l 107 0 l 107 609 l 0 609 l 0 749 l 107 749 q 145 949 107 894 q 328 1019 193 1019 l 424 1015 l 424 855 l 362 855 q 312 841 324 855 q 300 797 300 827 q 300 773 300 786 q 300 749 300 761 l 424 749 l 424 609 ',
            },
            g: {
                x_min: 0,
                x_max: 724,
                ha: 839,
                o: 'm 724 48 q 637 -223 724 -142 q 357 -304 551 -304 q 140 -253 226 -304 q 23 -72 36 -192 l 243 -72 q 290 -127 255 -110 q 368 -144 324 -144 q 504 -82 470 -144 q 530 71 530 -38 l 530 105 q 441 25 496 51 q 319 0 386 0 q 79 115 166 0 q 0 377 0 219 q 77 647 0 534 q 317 775 166 775 q 534 656 456 775 l 534 748 l 724 748 l 724 48 m 368 167 q 492 237 447 167 q 530 382 530 297 q 490 529 530 466 q 364 603 444 603 q 240 532 284 603 q 201 386 201 471 q 240 239 201 300 q 368 167 286 167 ',
            },
            h: {
                x_min: 0,
                x_max: 669,
                ha: 782,
                o: 'm 669 0 l 469 0 l 469 390 q 449 526 469 472 q 353 607 420 607 q 248 554 295 607 q 201 441 201 501 l 201 0 l 0 0 l 0 1013 l 201 1013 l 201 665 q 303 743 245 715 q 425 772 362 772 q 609 684 542 772 q 669 484 669 605 l 669 0 ',
            },
            i: { x_min: 14, x_max: 214, ha: 326, o: 'm 214 830 l 14 830 l 14 1013 l 214 1013 l 214 830 m 214 0 l 14 0 l 14 748 l 214 748 l 214 0 ' },
            j: {
                x_min: -45.828125,
                x_max: 242,
                ha: 361,
                o: 'm 242 830 l 42 830 l 42 1013 l 242 1013 l 242 830 m 242 -119 q 180 -267 242 -221 q 20 -308 127 -308 l -45 -308 l -45 -140 l -24 -140 q 25 -130 8 -140 q 42 -88 42 -120 l 42 748 l 242 748 l 242 -119 ',
            },
            k: { x_min: 0, x_max: 688.890625, ha: 771, o: 'm 688 0 l 450 0 l 270 316 l 196 237 l 196 0 l 0 0 l 0 1013 l 196 1013 l 196 483 l 433 748 l 675 748 l 413 469 l 688 0 ' },
            l: { x_min: 41, x_max: 240, ha: 363, o: 'm 240 0 l 41 0 l 41 1013 l 240 1013 l 240 0 ' },
            m: {
                x_min: 0,
                x_max: 1065,
                ha: 1174,
                o: 'm 1065 0 l 866 0 l 866 483 q 836 564 866 532 q 759 596 807 596 q 663 555 700 596 q 627 454 627 514 l 627 0 l 433 0 l 433 481 q 403 563 433 531 q 323 596 374 596 q 231 554 265 596 q 197 453 197 513 l 197 0 l 0 0 l 0 748 l 189 748 l 189 665 q 279 745 226 715 q 392 775 333 775 q 509 744 455 775 q 606 659 563 713 q 695 744 640 713 q 814 775 749 775 q 992 702 920 775 q 1065 523 1065 630 l 1065 0 ',
            },
            n: {
                x_min: 0,
                x_max: 669,
                ha: 782,
                o: 'm 669 0 l 469 0 l 469 452 q 442 553 469 513 q 352 601 412 601 q 245 553 290 601 q 200 441 200 505 l 200 0 l 0 0 l 0 748 l 194 748 l 194 659 q 289 744 230 713 q 416 775 349 775 q 600 700 531 775 q 669 509 669 626 l 669 0 ',
            },
            o: {
                x_min: 0,
                x_max: 764,
                ha: 871,
                o: 'm 380 -26 q 105 86 211 -26 q 0 371 0 199 q 104 660 0 545 q 380 775 209 775 q 658 659 552 775 q 764 371 764 544 q 658 86 764 199 q 380 -26 552 -26 m 379 141 q 515 216 466 141 q 557 373 557 280 q 515 530 557 465 q 379 607 466 607 q 245 530 294 607 q 204 373 204 465 q 245 217 204 282 q 379 141 294 141 ',
            },
            p: {
                x_min: 0,
                x_max: 722,
                ha: 824,
                o: 'm 415 -26 q 287 4 346 -26 q 192 92 228 34 l 192 -298 l 0 -298 l 0 750 l 192 750 l 192 647 q 289 740 230 706 q 416 775 347 775 q 649 645 566 775 q 722 375 722 534 q 649 106 722 218 q 415 -26 564 -26 m 363 603 q 232 529 278 603 q 192 375 192 465 q 230 222 192 286 q 360 146 276 146 q 487 221 441 146 q 526 371 526 285 q 488 523 526 458 q 363 603 443 603 ',
            },
            q: {
                x_min: 0,
                x_max: 722,
                ha: 833,
                o: 'm 722 -298 l 530 -298 l 530 97 q 306 -25 449 -25 q 73 104 159 -25 q 0 372 0 216 q 72 643 0 529 q 305 775 156 775 q 430 742 371 775 q 530 654 488 709 l 530 750 l 722 750 l 722 -298 m 360 601 q 234 527 278 601 q 197 378 197 466 q 233 225 197 291 q 357 144 277 144 q 488 217 441 144 q 530 370 530 282 q 491 523 530 459 q 360 601 443 601 ',
            },
            r: { x_min: 0, x_max: 431.9375, ha: 513, o: 'm 431 564 q 269 536 320 564 q 200 395 200 498 l 200 0 l 0 0 l 0 748 l 183 748 l 183 618 q 285 731 224 694 q 431 768 345 768 l 431 564 ' },
            s: {
                x_min: 0,
                x_max: 681,
                ha: 775,
                o: 'm 681 229 q 568 33 681 105 q 340 -29 471 -29 q 107 39 202 -29 q 0 245 0 114 l 201 245 q 252 155 201 189 q 358 128 295 128 q 436 144 401 128 q 482 205 482 166 q 363 284 482 255 q 143 348 181 329 q 25 533 25 408 q 129 716 25 647 q 340 778 220 778 q 554 710 465 778 q 658 522 643 643 l 463 522 q 419 596 458 570 q 327 622 380 622 q 255 606 290 622 q 221 556 221 590 q 339 473 221 506 q 561 404 528 420 q 681 229 681 344 ',
            },
            t: {
                x_min: 0,
                x_max: 412,
                ha: 511,
                o: 'm 412 -6 q 349 -8 391 -6 q 287 -11 307 -11 q 137 38 177 -11 q 97 203 97 87 l 97 609 l 0 609 l 0 749 l 97 749 l 97 951 l 297 951 l 297 749 l 412 749 l 412 609 l 297 609 l 297 191 q 315 152 297 162 q 366 143 334 143 q 389 143 378 143 q 412 143 400 143 l 412 -6 ',
            },
            u: {
                x_min: 0,
                x_max: 668,
                ha: 782,
                o: 'm 668 0 l 474 0 l 474 89 q 363 9 425 37 q 233 -19 301 -19 q 61 53 123 -19 q 0 239 0 126 l 0 749 l 199 749 l 199 296 q 225 193 199 233 q 316 146 257 146 q 424 193 380 146 q 469 304 469 240 l 469 749 l 668 749 l 668 0 ',
            },
            v: { x_min: 0, x_max: 740.28125, ha: 828, o: 'm 740 749 l 473 0 l 266 0 l 0 749 l 222 749 l 373 211 l 529 749 l 740 749 ' },
            w: { x_min: 0, x_max: 1056.953125, ha: 1150, o: 'm 1056 749 l 848 0 l 647 0 l 527 536 l 412 0 l 211 0 l 0 749 l 202 749 l 325 226 l 429 748 l 633 748 l 740 229 l 864 749 l 1056 749 ' },
            x: { x_min: 0, x_max: 738.890625, ha: 826, o: 'm 738 0 l 504 0 l 366 238 l 230 0 l 0 0 l 252 382 l 11 749 l 238 749 l 372 522 l 502 749 l 725 749 l 488 384 l 738 0 ' },
            y: {
                x_min: 0,
                x_max: 738.890625,
                ha: 828,
                o: 'm 738 749 l 444 -107 q 361 -238 413 -199 q 213 -277 308 -277 q 156 -275 176 -277 q 120 -271 131 -271 l 120 -110 q 147 -113 134 -111 q 179 -116 161 -116 q 247 -91 226 -116 q 269 -17 269 -67 q 206 173 269 -4 q 84 515 162 301 q 0 749 41 632 l 218 749 l 376 207 l 529 749 l 738 749 ',
            },
            z: { x_min: 0, x_max: 663.890625, ha: 753, o: 'm 663 0 l 0 0 l 0 154 l 411 591 l 25 591 l 25 749 l 650 749 l 650 584 l 245 165 l 663 165 l 663 0 ' },

            '+': { x_min: 43, x_max: 784, ha: 828, o: 'm 784 353 l 483 353 l 483 0 l 343 0 l 343 353 l 43 353 l 43 489 l 343 489 l 343 840 l 483 840 l 483 489 l 784 489 l 784 353 ' },
            '-': { x_min: 27.78125, x_max: 413.890625, ha: 525, o: 'm 413 279 l 27 279 l 27 468 l 413 468 l 413 279 ' },
            '.': { x_min: 0, x_max: 206, ha: 303, o: 'm 206 0 l 0 0 l 0 207 l 206 207 l 206 0 ' },
            ':': { x_min: 0, x_max: 207, ha: 304, o: 'm 207 528 l 0 528 l 0 735 l 207 735 l 207 528 m 207 0 l 0 0 l 0 207 l 207 207 l 207 0 ' },
            ',': { x_min: 0, x_max: 206, ha: 303, o: 'm 206 5 q 150 -151 206 -88 q 0 -238 94 -213 l 0 -159 q 84 -100 56 -137 q 111 -2 111 -62 l 0 -2 l 0 205 l 206 205 l 206 5 ' },
            ';': {
                x_min: 0,
                x_max: 208,
                ha: 306,
                o: 'm 208 528 l 0 528 l 0 735 l 208 735 l 208 528 m 208 6 q 152 -151 208 -89 q 0 -238 96 -212 l 0 -158 q 87 -100 61 -136 q 113 0 113 -65 l 0 0 l 0 207 l 208 207 l 208 6 ',
            },
            '!': {
                x_min: 0,
                x_max: 204,
                ha: 307,
                o: 'm 204 739 q 182 515 204 686 q 152 282 167 398 l 52 282 q 13 589 27 473 q 0 739 0 704 l 0 1013 l 204 1013 l 204 739 m 204 0 l 0 0 l 0 203 l 204 203 l 204 0 ',
            },
            '?': {
                x_min: 1,
                x_max: 687,
                ha: 785,
                o: 'm 687 734 q 621 563 687 634 q 501 454 560 508 q 436 293 436 386 l 251 293 l 251 391 q 363 557 251 462 q 476 724 476 653 q 432 827 476 788 q 332 866 389 866 q 238 827 275 866 q 195 699 195 781 l 1 699 q 110 955 1 861 q 352 1040 210 1040 q 582 963 489 1040 q 687 734 687 878 m 446 0 l 243 0 l 243 203 l 446 203 l 446 0 ',
            },
            _: { x_min: 61.109375, x_max: 766.671875, ha: 828, o: 'm 766 -333 l 61 -333 l 61 -190 l 766 -190 l 766 -333 ' },
            '/': { x_min: 196.109375, x_max: 632.5625, ha: 828, o: 'm 632 1040 l 289 -128 l 196 -128 l 538 1040 l 632 1040 ' },
            '(': {
                x_min: 0,
                x_max: 388.890625,
                ha: 486,
                o: 'm 388 -293 l 243 -293 q 70 14 130 -134 q 0 357 0 189 q 69 703 0 526 q 243 1013 129 856 l 388 1013 q 248 695 297 860 q 200 358 200 530 q 248 24 200 187 q 388 -293 297 -138 ',
            },
            ')': {
                x_min: 0,
                x_max: 389,
                ha: 486,
                o: 'm 389 357 q 319 14 389 187 q 145 -293 259 -134 l 0 -293 q 139 22 90 -142 q 189 358 189 187 q 139 689 189 525 q 0 1013 90 853 l 145 1013 q 319 703 258 857 q 389 357 389 528 ',
            },
            '{': {
                x_min: 0,
                x_max: 501.390625,
                ha: 599,
                o: 'm 501 -285 q 229 -209 301 -285 q 176 -35 176 -155 q 182 47 176 -8 q 189 126 189 103 q 156 245 189 209 q 0 294 112 294 l 0 438 q 154 485 111 438 q 189 603 189 522 q 186 666 189 636 q 176 783 176 772 q 231 945 176 894 q 501 1015 306 1015 l 501 872 q 370 833 408 872 q 340 737 340 801 q 342 677 340 705 q 353 569 353 579 q 326 451 353 496 q 207 366 291 393 q 327 289 294 346 q 353 164 353 246 q 348 79 353 132 q 344 17 344 26 q 372 -95 344 -58 q 501 -141 408 -141 l 501 -285 ',
            },
            '}': {
                x_min: 0,
                x_max: 500,
                ha: 597,
                o: 'm 500 294 q 348 246 390 294 q 315 128 315 209 q 320 42 315 101 q 326 -48 326 -17 q 270 -214 326 -161 q 0 -285 196 -285 l 0 -141 q 126 -97 90 -141 q 154 8 154 -64 q 150 91 154 37 q 146 157 146 145 q 172 281 146 235 q 294 366 206 339 q 173 451 208 390 q 146 576 146 500 q 150 655 146 603 q 154 731 154 708 q 126 831 154 799 q 0 872 90 872 l 0 1015 q 270 944 196 1015 q 326 777 326 891 q 322 707 326 747 q 313 593 313 612 q 347 482 313 518 q 500 438 390 438 l 500 294 ',
            },
            '<': { x_min: 35.984375, x_max: 791.671875, ha: 828, o: 'm 791 17 l 36 352 l 35 487 l 791 823 l 791 672 l 229 421 l 791 168 l 791 17 ' },
            '>': { x_min: 36.109375, x_max: 792, ha: 828, o: 'm 792 352 l 36 17 l 36 168 l 594 420 l 36 672 l 36 823 l 792 487 l 792 352 ' },
            ' ': { x_min: 0, x_max: 0, ha: 375 },
        },
        cssFontWeight: 'bold',
        lineHeight: 1549,
        ascender: 1216,
        descender: -334,
        underlinePosition: -100,
        underlineThickness: 50,
        cssFontStyle: 'normal',
        boundingBox: { yMin: -333, xMin: -162, yMax: 1216, xMax: 1681 },
        resolution: 1000,
        familyName: 'Helvetiker',
    };

    // ----------------------------------------------------------- THREE EXPERIENCE

    // The elements of the Three experience
    let gl,
        canvas,
        renderer,
        scene,
        camera,
        light,
        session,
        pose,
        reticle,
        referenceSpace,
        viewerSpace,
        hitTestSource,
        signPost,
        font,
        currentTime = 0,
        lastTime = 0,
        deltaTime,
        fpsTime = 0,
        fpsCounter = 0,
        fps;

    /** Initializes the Three experience. */
    async function initThreeExperience() {
        // mainElement.style.display = "block";

        // Try to load the Resources
        let loaded = false;
        try {
            loaded = THREE !== undefined;
        } catch (e) {}
        if (!loaded) {
            let script = createDomElement('script', null, document.body);
            script.src = 'https://unpkg.com/three@0.126.0/build/three.js';
            requestAnimationFrame(loadThreeExperience);
        }
    }

    /** Loads the resources of the Three experience. */
    async function loadThreeExperience() {
        let loaded = false;
        try {
            loaded = THREE !== undefined;
        } catch (e) {}
        if (loaded) {
            const loader = new THREE.FontLoader();
            // loader.load( 'helvetiker_bold.typeface.json',
            // 	function ( response ) {font = response;  startThreeExperience();} );
            font = loader.parse(fontData);
            startThreeExperience();
        } else requestAnimationFrame(loadThreeExperience);
    }

    /** Starts the Three experience. */
    async function startThreeExperience() {
        // Check WebXR support
        if (navigator.xr == undefined) throw new Error('XR is not supported');

        // Display the main element
        mainElement.style.display = 'block';

        // Add a canvas element and initialize a WebGL context
        canvas = document.createElement('canvas', mainElement);
        mainElement.appendChild(canvas);
        gl = canvas.getContext('webgl', { xrCompatible: true });

        // Set up the renderer
        renderer = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true, canvas: canvas, context: gl });
        renderer.autoClear = false;
        let width = window.innerWidth,
            height = window.innerHeight;
        renderer.setSize(width, height);

        // Allow the user to add an offset to the orientation
        document.addEventListener('pointermove', (event) => {
            yawOffset += event.movementX * 100;
        });

        // Create the scene
        scene = new THREE.Scene();

        // Create the lights
        scene.add(new THREE.AmbientLight(0x666666, 2));
        light = new THREE.SpotLight(0xffffff);
        light.position.set(0, 10, 0);
        light.rotation.set(Math.PI, 0, 0);
        scene.add(light);

        // Create the camera
        // Disable matrix auto updates so three.js doesn't attempt
        // to handle the matrices independently.
        camera = new THREE.PerspectiveCamera(75, width / height, 0.01, 100);
        camera.updateProjectionMatrix();
        camera.matrixAutoUpdate = false;

        // Create the reticle
        reticle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 32), new THREE.MeshPhongMaterial({ color: 0x0000aa, opacity: 0.5, transparent: true }));
        reticle.position.z = -5;
        scene.add(reticle);
        reticle.visible = false;

        // Initialize a Three session using "immersive-ar".
        session = await navigator.xr.requestSession('immersive-ar', {
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: mainElement },
            requiredFeatures: ['hit-test'],
        });
        session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

        // Free the resources when the XR session ends
        session.onend = (event) => {
            session = null;
            mainElement.style.display = 'none';
        };

        // A 'local' reference space has a native origin that is located
        // near the viewer's position at the time the session was created.
        referenceSpace = await session.requestReferenceSpace('local');

        // Create another XRReferenceSpace that has the viewer as the origin.
        viewerSpace = await session.requestReferenceSpace('viewer');

        // Perform hit testing using the viewer as origin.
        hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

        // Start updating the XR session
        session.requestAnimationFrame(updateThreeExperience);
    }

    /** Updates the the demo XR session.
     * @param time The new time.
     * @param frame The frame of reference. */
    function updateThreeExperience(time, frame) {
        // Calculate the FPS
        currentTime = time / 1000;
        deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        fpsTime += deltaTime;
        fpsCounter++;
        if (fpsTime > 1) {
            fpsTime %= 1;
            fps = fpsCounter;
            fpsCounter = 0;
            //		if(debugTitle) debugTitle.innerText = "Debug: FPS: " + fps;
        }

        // Updates the information panel.
        infoPanel.innerHTML =
            'GeoPose: {<br>' +
            '&nbsp;  position: { lat: ' +
            geopose.latitude.toFixed(4) +
            ', ' +
            'lng: ' +
            geopose.longitude.toFixed(4) +
            ', ' +
            'h: ' +
            geopose.altitude.toFixed(1) +
            ' },<br>' +
            '&nbsp;  angles: { yaw: ' +
            geopose.yaw.toFixed(1) +
            ', ' +
            'pitch: ' +
            geopose.pitch.toFixed(1) +
            ', ' +
            'roll: ' +
            geopose.roll.toFixed(1) +
            ' }<br>}';

        // Queue up the next draw request.
        session.requestAnimationFrame(updateThreeExperience);

        // Bind the graphics framebuffer to the baseLayer's framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);

        // Retrieve the pose of the device. XRFrame.getViewerPose can return
        // null while the session attempts to establish tracking.
        if (frame) pose = frame.getViewerPose(referenceSpace);
        if (pose) {
            // In mobile AR, we only have one view.
            const view = pose.views[0];
            const viewport = session.renderState.baseLayer.getViewport(view);
            renderer.setSize(viewport.width, viewport.height);

            // Use the view's transform matrix and projection matrix to configure
            //the THREE.camera.
            camera.matrix.fromArray(view.transform.matrix);
            camera.projectionMatrix.fromArray(view.projectionMatrix);
            camera.updateMatrixWorld(true);

            // Set the reticle
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            reticle.visible = signPost ? false : true;
            if (hitTestResults.length > 0 && reticle.visible) {
                const hitPose = hitTestResults[0].getPose(referenceSpace);
                let p = hitPose.transform.position,
                    r = hitPose.transform.orientation;
                reticle.position.set(p.x, p.y, p.z);
                reticle.rotation.set(0, 0, 0);
                // reticle.rotation.setFromQuaternion(new THREE.Quaternion(
                // 	r.x,r.y,r.z,r.w));
                // reticle.rotateY(-geopose.yaw * Math.PI/180);
                reticle.updateMatrixWorld(true);
            }
        } else reticle.visible = false;

        // TODO do it with a calbback function
        if (signPost) signPost.update(deltaTime);

        // Render the scene with THREE.WebGLRenderer.
        renderer.render(scene, camera);
    }

    /** Shuts down the XR session. */
    async function shutdownThreeExperience() {
        if (session) {
            await session.end();
            mainElement.style.display = 'none';
        }
    }

    // ----------------------------------------------------------------- POST CLASS

    /** Defines a post. */
    class Post {
        /** Initializes the Post instance. */
        constructor(position, rotation, radius, height) {
            // Create the fields of the instance
            this.position = position;
            this.rotation = rotation;
            this.radius = radius;
            this.height = height;
            this.signs = [];
            this.object = new THREE.Object3D();

            // Create the post
            let post = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32), new THREE.MeshPhongMaterial({ color: 0xff8800 }));
            post.position.set(0, 1, 0);
            post.castShadow = true;
            post.receiveShadow = true;
            this.object.add(post);

            this.object.position.set(position.x, position.y, position.z);
            this.object.rotation.set(rotation.x, rotation.y, rotation.z);
            scene.add(this.object);
            this.animation = 0;
            this.maxAnimation = 1;
        }

        /** Updates the post elements. */
        update(deltaTime) {
            if (deltaTime > 0.1) deltaTime = 0.1;
            if (this.animation < this.maxAnimation) this.animation += deltaTime;
            else this.animation = this.maxAnimation;
            this.object.scale.y = this.animation / this.maxAnimation;
            this.signs.forEach((sign) => {
                sign.update(deltaTime);
            });
        }
    }

    // ----------------------------------------------------------------- SIGN CLASS

    /** Defines a sign. */
    class Sign {
        /** Initializes the Sign instance. */
        constructor(post, latitude, longitude, height, depth, bevel, text, color, background, animationDelay = 1) {
            // Create the fields of the instance
            this.post = post;
            this.latitude = latitude;
            this.longitude = longitude;
            this.height = height;
            this.depth = depth;
            this.bevel = bevel;
            this.text = text;
            this.color = color;
            this.background = background;

            // Calculate the distance and the bearing
            // https://www.movable-type.co.uk/scripts/latlong.html
            const R = 6371e3,
                deg2rads = Math.PI / 180,
                φ1 = geopose.latitude * deg2rads,
                φ2 = this.latitude * deg2rads,
                Δφ = φ2 - φ1,
                λ1 = geopose.longitude * deg2rads,
                λ2 = this.longitude * deg2rads,
                Δλ = λ2 - λ1,
                a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2),
                c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
                y = Math.sin(λ2 - λ1) * Math.cos(φ2),
                x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1),
                θ = Math.atan2(y, x);
            this.distance = (R * c) / 1000; // Distance in kilometers
            this.bearing = ((θ * 180) / Math.PI + 360) % 360; // in degrees
            this.position = this.post.height - this.post.signs.length * 0.12;
            this.rotation = -(this.bearing * deg2rads) + Math.PI / 2;
            this.length = 0.4;

            // Create the two texts (one for each side of the sign)
            this.text = this.text + ' ' + this.distance.toFixed(0) + ' Km';
            this.textGeometry = new THREE.TextGeometry(this.text, { font: font, size: 0.05, height: 0.002 });
            this.textColor = new THREE.MeshPhongMaterial({ color: this.color || 0x010101 });
            this.text1 = new THREE.Mesh(this.textGeometry, this.textColor);
            this.text1.receiveShadow = true;
            this.textSize = new THREE.Vector3();
            new THREE.Box3().setFromObject(this.text1).getSize(this.textSize);
            this.length = this.textSize.x + this.bevel + 0.1;
            this.text1.position.set(this.post.radius + 0.05, -this.height * 0.7, this.depth);
            this.text2 = new THREE.Mesh(this.textGeometry, this.textColor);
            this.text2.receiveShadow = true;
            this.text2.position.set(this.post.radius + (this.length - this.bevel), -this.height * 0.7, 0);
            this.text2.rotation.set(0, Math.PI, 0);

            // Create the main object of the sign
            this.shape = new THREE.Shape();
            this.shape.moveTo(this.post.radius, 0);
            this.shape.lineTo(this.post.radius + (this.length - this.bevel), 0);
            this.shape.lineTo(this.post.radius + this.length, -this.height / 2);
            this.shape.lineTo(this.post.radius + (this.length - this.bevel), -this.height);
            this.shape.lineTo(this.post.radius, -this.height);
            this.object = new THREE.Mesh(
                new THREE.ExtrudeGeometry(this.shape, { steps: 2, depth: this.depth, bevelEnabled: false }),
                new THREE.MeshPhongMaterial({ color: this.background || 0xffffff }),
            );
            this.object.position.set(0, this.position, 0);
            this.object.rotation.set(0, this.rotation, 0);
            this.post.castShadow = true;
            post.receiveShadow = true;
            this.post.object.add(this.object);
            this.object.add(this.text1);
            this.object.add(this.text2);
            this.animation = -animationDelay;
            this.maxAnimation = 1;
            this.object.scale.x = 0;
        }

        /** Updates the sign elements. */
        update(deltaTime) {
            if (this.animation < this.maxAnimation) this.animation += deltaTime;
            else this.animation = this.maxAnimation;
            this.object.scale.x = this.animation / this.maxAnimation;
            if (this.object.scale.x < 0) this.object.scale.x = 0;
        }
    }

    // The sign data (From top to bottom)
    let signData = [
        { name: 'North', latitude: 90, longitude: 135, background: 0xff0000, color: 0xffffff },
        { name: 'Paris', latitude: 48.8589507, longitude: 2.2770205, background: 0xffffff },
        { name: 'Tokyo', latitude: 35.689722, longitude: 139.692222, background: 0xffffff },
        { name: 'New York', latitude: 40.712778, longitude: -74.006111, background: 0xffffff },
        { name: 'Sydney', latitude: -33.865, longitude: 151.209444, background: 0xffffff },
    ];

    // ------------------------------------------------------------- USER INTERFACE

    // The main element
    let mainElement = createDomElement('div', 'ThreeExperience', null, '', '', 'width:100%; height:100%; font: 1cm arial; display: none');

    // The back button
    let backButton = document.getElementById('ThreeExperienceBackButton');
    if (!backButton)
        backButton = createDomElement(
            'div',
            'ThreeExperienceBackButton',
            mainElement,
            '<-',
            '',
            'position: fixed; bottom:-0.4cm; left:-0.4cm; width:2cm; height:2cm;' +
                'background:#00008888; color:white; border-radius: 1cm; ' +
                'text-align:center; padding: 0.3cm 0.3cm; box-sizing: border-box;',
        );
    backButton.onclick = () => {
        shutdownThreeExperience();
    };

    // The plus button
    let plusButton = document.getElementById('ThreeExperiencePlusButton');
    if (!plusButton)
        plusButton = createDomElement(
            'div',
            'ThreeExperiencePlusButton',
            mainElement,
            '+',
            '',
            'position: fixed; bottom:-0.4cm; right:-0.4cm; width:2cm; height:2cm;' +
                'background: #00008888; color:white; border-radius: 1cm; ' +
                'text-align:center; padding: 0.3cm 0.3cm; box-sizing: border-box;',
        );
    plusButton.onclick = () => {
        if (!signPost) {
            if (!reticle.visible) return;

            // Create the post
            signPost = new Post(reticle.position, reticle.rotation, 0.05, 2);

            // Create the signs
            for (let signIndex = 0; signIndex < signData.length; signIndex++) {
                let sign = signData[signIndex];
                signPost.signs.push(new Sign(signPost, sign.latitude, sign.longitude, 0.12, 0.02, 0.1, sign.name, sign.color, sign.background, 1 + signIndex * 0.5));
            }
        } else signWindow.style.display = 'block';
    };

    // The information Panel
    let infoPanel = createDomElement('div', 'ThreeExperienceInfoPanel', mainElement, 'InfoPanel', '', 'position: fixed; top:0; left:0; background: #00008888; color:white; ' + 'font-size: 0.4cm;');

    // The new sign window
    addCssRule(
        '#SignWindow',
        'position:fixed; width: auto; font-size: 3vmin;' +
            'top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;' +
            'border: 0.1vmin solid black; border-radius: 5vmin; outline: none;' +
            'background: white; box-shadow: 0px 0px 5vmin black; display: none;',
    );
    addCssRule('#SignWindowHeader', 'font-size: 4vmin; margin: 2vmin; font-weight: bold');
    addCssRule('#SignWindow input', 'font-size: 3vmin; margin-left:2vmin;' + 'border: 0.1vmin solid black; border-radius: 1vmin; padding-left: 1vmin;');
    addCssRule('#SignWindow button', 'font-size: 3.5vmin; margin: 2vmin; padding: 2vmin;' + 'border: 0.1vmin solid black; border-radius: 2vmin; outline: none;');
    addCssRule('#SignWindowHeader', 'width: 100%;');
    addCssRule('.signWindowLine', 'display: flex; justify-content: space-between;padding:1vmin;');
    let signWindow = createDomElement('div', 'SignWindow', mainElement);
    let signWindowHeader = createDomElement('div', 'SignWindowHeader', signWindow, 'Create a new sign:');
    let signName = createDomElement('div', 'signWindowInputs', signWindow, null, 'signWindowLine');
    let signNameLabel = createDomElement('label', 'SgnNameLabel', signName, 'Name:');
    let signNameInput = createDomElement('input', 'SignNameInput', signName);
    let signLatitude = createDomElement('div', 'SignWindowInputs', signWindow, null, 'signWindowLine');
    let signLatitudeLabel = createDomElement('label', 'SignLatitudeLabel', signLatitude, 'Latitude:');
    let signLatitudeInput = createDomElement('input', 'SignLatitudeInput', signLatitude);
    let signLongitude = createDomElement('div', 'SignLongitude', signWindow, null, 'signWindowLine');
    let signLongitudeLabel = createDomElement('label', 'SignLongitudeLabel', signLongitude, 'Longitude:');
    let signLongitudeInput = createDomElement('input', 'SignLongitudeInput', signLongitude);
    let signCancelButton = createDomElement('button', 'SignCancelButton', signWindow, 'Cancel');
    let signCreateButton = createDomElement('button', 'SignNewButton', signWindow, 'Create');
    signNameInput.value = 'ISMAR';
    signLatitudeInput.value = '41.1093896';
    signLongitudeInput.value = '16.8777035';
    signCancelButton.onclick = () => {
        signWindow.style.display = 'none';
    };
    signCreateButton.onclick = () => {
        signWindow.style.display = 'none';
        signPost.signs.push(new Sign(signPost, parseFloat(signLatitudeInput.value), parseFloat(signLongitudeInput.value), 0.12, 0.02, 0.1, signNameInput.value, 0xffffff, 0x4444aa, 0));
    };

    // Create the debug panel element
    let debugPanel = createDomElement('div', 'DebugPanel', mainElement);
    let debugHeader = createDomElement('div', 'DebugHeader', debugPanel, '');
    let debugTitle = createDomElement('div', 'DebugTitle', debugHeader, 'Debug: ');
    let debugMessages = createDomElement('div', 'DebugMessages', debugPanel);
    let debugButtons = createDomElement('div', 'DebugButtons', debugHeader);
    let debugClear = createDomElement('button', 'DebugClear', debugButtons, 'Clear');
    let debugClose = createDomElement('button', 'DebugClose', debugButtons, 'X');
    debugClear.onclick = clearDebugMessages;
    debugClose.onclick = hideDebugPanel;

    addCssRule(
        '#DebugPanel',
        'position: fixed; width:100%; height: 50%; ' + 'bottom:0; z-index: 1000; background-color: #00000080; color:white; ' + 'overflow-y: auto; font: 14px arial; display: none',
    );
    addCssRule('#DebugHeader', 'background: #00000040; width:100%; padding:1vmin;' + 'display: flex; justify-content: space-between;');
    addCssRule('#DebugMessages', 'overflow-y: auto;');
    addCssRule('#DebugMessages p', 'margin: 1vmin;');
    addCssRule('#LoadingScreen', ' position:fixed; margin:0; border:none; ' + 'width:100%; height:100%; z-index:900; background:black; color:white;');

    /** Shows the debug panel. */
    function showDebugPanel() {
        debugPanel.style.display = 'block';
    }

    /** Hides the debug panel. */
    function hideDebugPanel() {
        debugPanel.style.display = 'none';
    }

    /** Toggles the debug panel visibility. */
    function toggleDebugPanel() {
        debugPanel.style.display = debugPanel.style.display == 'none' ? 'block' : 'none';
    }

    /** Sets the debug panel.
     * @param text The text of the panel title. */
    function setDebugPanelTitle(text) {
        debugTitle.innerText = 'Debug: ' + text;
    }

    /** Captures console messages and displays them.
     * @param text The text of the debug message.
     * @param type The type of debug message. */
    function createDebugMessage(text, type = 0) {
        let element = document.createElement('p');
        switch (type) {
            case 0:
                element.style.color = 'white';
                break; // Info message
            case 1:
                element.style.color = 'yellow';
                break; // Warning message
            case 2:
                element.style.color = 'red';
                break; // Error message
        }
        element.innerText = text;
        debugMessages.append(element);
        if (type == 2) showDebugPanel();
    }

    /** Clears the console messages. */
    function clearDebugMessages() {
        debugMessages.innerHTML = '';
    }

    // Capture console messages
    let oldInfo = console.log,
        oldWarning = console.warn,
        oldError = console.error;
    console.log = (msg) => {
        createDebugMessage(msg, 0);
        oldInfo(msg);
    };
    console.warn = (msg) => {
        createDebugMessage(msg, 1);
        oldWarning(msg);
    };
    console.error = (msg) => {
        createDebugMessage(msg, 2);
        oldError(msg);
    };

    // Capture error messages
    window.onerror = (message, source, lineno, colno, error) => {
        createDebugMessage(error + ' in line ' + lineno + ' of ' + source, 2);
    };
    window.onunhandledrejection = (e) => {
        createDebugMessage(e.reason, 2);
    };
    window.onkeyup = (e) => {
        if (e.code == 'Backquote') toggleDebugPanel();
    };
    window.ontouchstart = (e) => {
        if (e.touches.length > 2) toggleDebugPanel();
    };

    // Start with the debug panel hidden
    hideDebugPanel();
</script>

<button on:click={initThreeExperience}>Start Demo</button>
