(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
        typeof define === 'function' && define.amd ? define(['exports'], factory) :
            (global = global || self, factory(global.ImageProcessing = {}));
}(this, (function (exports) {
    'use strict';



    function ImageProcesser(img, kernel = null, xform = null, bhandler = 'icrop') {
        this.img = img.clone();
        this.width = img.shape[1];
        this.height = img.shape[0];
        this.kernel = kernel;
        this.xform = xform;
        this.bhandler = bhandler;
    }

    Object.assign(ImageProcesser.prototype, {

        apply_kernel: function (border = 'icrop') {
            const filter_border = 1;
            const filter_padding = 2 * filter_border;
            const filter_size = filter_padding + 1;

            const laplace_filter = nj.int8([[0, -1, 0], [-1, 4, -1], [0, -1, 0]]);
            const sobel_right_filter = nj.int8([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]])
            const sobel_down_filter = nj.int8([[1, 2, 1], [0, 0, 0], [-1, -2, -1]])

            if (border === 'extend') {
                const extended = nj.zeros([this.height + filter_padding, this.width + filter_padding, 4], 'uint8')
                for (var y = 0; y < this.height + filter_padding; y++) {
                    for (var x = 0; x < this.width + filter_padding; x++) {
                        var original_x = x >= this.width + filter_border ? this.width - 1 : x >= filter_border ? x - filter_border : 0;
                        var original_y = y >= this.height + filter_border ? this.height - 1 : y >= filter_border ? y - filter_border : 0;
                        for (var k = 0; k < 4; k++)
                            extended.set(y, x, k, this.img.get(original_y, original_x, k));
                    }
                }
                this.img = extended;
                this.height = this.img.shape[0];
                this.width = this.img.shape[1];
            }

            const new_img = nj.zeros([this.height, this.width, 4], 'uint8');

            for (var y = filter_border; y < this.height - filter_border; y++) {
                for (var x = filter_border; x < this.height - filter_border; x++) {
                    var filter = this.img.slice([y - filter_border, y + filter_border + 1], [x - filter_border, x + filter_border + 1]);

                    if (this.kernel === 'box') {
                        var result = nj.zeros(4);
                        result.set(3, 255);

                        for (var i = 0; i < filter_size; i++) {
                            for (var j = 0; j < filter_size; j++) {
                                for (var k = 0; k < 3; k++) {
                                    result.set(k, result.get(k) + filter.get(i, j, k) / 9);
                                }
                            }
                        }

                        for (var k = 0; k < 4; k++) {
                            new_img.set(y, x, k, result.get(k));
                        }
                    } else if (this.kernel === 'sobel') {
                        var result_x = 0;
                        var result_y = 0;

                        for (var i = 0; i < filter_size; i++) {
                            for (var j = 0; j < filter_size; j++) {
                                const gray = 0.299 * filter.get(i, j, 0) + 0.587 * filter.get(i, j, 1) + 0.114 * filter.get(i, j, 2);
                                result_x += gray * sobel_right_filter.get(i, j) / 8;
                                result_y += gray * sobel_down_filter.get(i, j) / 8;
                            }
                        }

                        var result = 2 * Math.abs(Math.sqrt(result_x ** 2 + result_y ** 2));

                        for (var k = 0; k < 3; k++) {
                            new_img.set(y, x, k, result);
                        }
                        new_img.set(y, x, k, 255);

                    } else if (this.kernel === 'laplace') {
                        var result = 0;

                        for (var i = 0; i < filter_size; i++) {
                            for (var j = 0; j < filter_size; j++) {
                                const gray = 0.299 * filter.get(i, j, 0) + 0.587 * filter.get(i, j, 1) + 0.114 * filter.get(i, j, 2);
                                result += gray * laplace_filter.get(i, j) / 4;
                            }
                        }

                        result = 2 * Math.abs(result);

                        for (var k = 0; k < 3; k++) {
                            new_img.set(y, x, k, result);
                        }
                        new_img.set(y, x, k, 255);
                    }
                }
            }

            this.img = new_img
        },

        apply_xform: function () {
            // Method to apply affine transform through inverse mapping (incomplete)
            // You may create auxiliary functions/methods if you'd like
        },

        update: function () {
            // Method to process image and present results
            var start = new Date().valueOf();

            if (this.kernel != null) {
                this.apply_kernel(this.bhandler);
            }

            if (this.xform != null) {
                this.apply_xform();
            }

            // Loading HTML elements and saving
            var $transformed = document.getElementById('transformed');
            $transformed.width = this.width; $transformed.height = this.height;
            nj.images.save(this.img, $transformed);
            var duration = new Date().valueOf() - start;
            document.getElementById('duration').textContent = '' + duration;
        }

    })


    exports.ImageProcesser = ImageProcesser;


})));
