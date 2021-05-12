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

            this.img = new_img;
            this.height = this.img.shape[0];
            this.width = this.img.shape[1];
        },

        apply_xform: function () {
            var a = this.xform.get(0, 0), b = this.xform.get(0, 1), c = this.xform.get(0, 2);
            var d = this.xform.get(1, 0), e = this.xform.get(1, 1), f = this.xform.get(1, 2);
            var g = this.xform.get(2, 0), h = this.xform.get(2, 1), i = this.xform.get(2, 2);
            var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
            var D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
            var G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
            var det = a * A + b * B + c * C;
            const inverse_xform = nj.zeros([3, 3]);
            inverse_xform.set(0, 0, A / det);
            inverse_xform.set(1, 0, B / det);
            inverse_xform.set(2, 0, C / det);
            inverse_xform.set(0, 1, D / det);
            inverse_xform.set(1, 1, E / det);
            inverse_xform.set(2, 1, F / det);
            inverse_xform.set(0, 2, G / det);
            inverse_xform.set(1, 2, H / det);
            inverse_xform.set(2, 2, I / det);


            const new_img = nj.zeros([3 * this.height, 3 * this.width, 4], 'uint8');

            for (var y = -this.height; y < 2 * this.height; y++) {
                for (var x = -this.width; x < 2 * this.width; x++) {
                    var original = inverse_xform.dot(nj.array([x, y, 1]).T);
                    var original_x = original.get(0), original_y = original.get(1);
                    if (original_x < 0 || original_x >= this.width || original_y < 0 || original_y >= this.height) {
                        new_img.set(y + this.height, x + this.width, [255, 255, 255, 255]);
                    } else {
                        for (var k = 0; k < 3; k++) {
                            var low_x = Math.floor(original_x);
                            var high_x = low_x + 1;
                            var low_y = Math.floor(original_y);
                            var high_y = low_y + 1;
                            var a = original_x - low_x, b = original_y - low_y;

                            var result = (1 - a) * (1 - b) * this.img.get(low_y, low_x, k) + a * (1 - b) * this.img.get(low_y, high_x, k)
                                + a * b * this.img.get(high_y, high_x, k) + (1 - a) * b * this.img.get(high_y, low_x, k);

                            new_img.set(y + this.height, x + this.width, k, result);
                        }
                        new_img.set(y + this.height, x + this.width, 3, 255);
                    }
                }
            }

            this.img = new_img;
            this.height = this.img.shape[0];
            this.width = this.img.shape[1];
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
