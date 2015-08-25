/**
 * Binds a TinyMCE widget to <textarea> elements test.
 */
angular.module('ui.tinymce', [])
	.value('uiTinymceConfig', {})
	.directive('uiTinymce', ['$rootScope', '$compile', '$timeout', '$window', '$sce', 'uiTinymceConfig', function ($rootScope, $compile, $timeout, $window, $sce, uiTinymceConfig) {
		uiTinymceConfig = uiTinymceConfig || {};
		var generatedIds = 0;
		var ID_ATTR = 'ui-tinymce';
		if (uiTinymceConfig.baseUrl) {
			tinymce.baseURL = uiTinymceConfig.baseUrl;
		}

		return {
			require: ['ngModel', '^?form'],
			link: function (scope, element, attrs, ctrls) {
				if (!$window.tinymce) {
					return;
				}

				var ngModel = ctrls[0],
					form = ctrls[1] || null;

				var expression, options, tinyInstance, inFocus,
					updateView = function (editor) {
						var content = editor.getContent({format: options.format}).trim();
						content = $sce.trustAsHtml(content);

						ngModel.$setViewValue(content);
						if (!$rootScope.$$phase) {
							scope.$apply();
						}
					};

				function toggleDisable(disabled) {
					if (disabled) {
						ensureInstance();

						if (tinyInstance) {
							tinyInstance.getBody().setAttribute('contenteditable', false);
							angular.element(tinyInstance.getBody()).addClass('editor-disable');
						}
					} else {
						ensureInstance();

						if (tinyInstance) {
							tinyInstance.getBody().setAttribute('contenteditable', true);
							angular.element(tinyInstance.getBody()).removeClass('editor-disable');
						}
					}
				}

				expression = {};

				angular.extend(expression, scope.$eval(attrs.uiTinymce));

				if (expression.id) {
					attrs.$set('id', expression.id);
				} else {
					// generate an ID
					attrs.$set('id', ID_ATTR + '-' + generatedIds++);
				}
				options = {
					// Update model when calling setContent
					// (such as from the source editor popup)
					setup: function (ed) {
						ed.on('init', function () {
							ngModel.$render();
							ngModel.$setPristine();
							//if (form) {
							//	form.$setPristine();
							//}
							_initValidation();
							ngModel.$validate();
						});

						// Update model on button click
						ed.on('ExecCommand', function () {
							ed.save();
							updateView(ed);
						});

						// Update model on change
						ed.on('change', function (e) {
							ed.save();
							updateView(ed);
						});

						ed.on('blur', function () {
							inFocus = false;
							element[0].blur();
						});

						ed.on('focus', function () {
							inFocus = true;
							ngModel.$setDirty();
						});

						// Update model when an object has been resized (table, image)
						ed.on('ObjectResized', function () {
							ed.save();
							updateView(ed);
						});

						ed.on('remove', function () {
							element.remove();
						});

						if (expression.setup) {
							expression.setup(ed, {
								updateView: updateView
							});
						}
					},
					format: 'raw',
					selector: '#' + attrs.id
				};
				// extend options with initial uiTinymceConfig and
				// options from directive attribute value
				angular.extend(options, uiTinymceConfig, expression);
				// Wrapped in $timeout due to $tinymce:refresh implementation, requires
				// element to be present in DOM before instantiating editor when
				// re-rendering directive
				$timeout(function () {
					tinymce.init(options);
					toggleDisable(scope.$eval(attrs.ngDisabled));
				});

				ngModel.$formatters.unshift(function (modelValue) {
					return modelValue ? $sce.trustAsHtml(modelValue) : '';
				});

				ngModel.$parsers.unshift(function (viewValue) {
					return viewValue ? $sce.getTrustedHtml(viewValue) : '';
				});

				ngModel.$render = function () {
					ensureInstance();

					var viewValue = ngModel.$viewValue ?
						$sce.getTrustedHtml(ngModel.$viewValue) : '';

					// instance.getDoc() check is a guard against null value
					// when destruction & recreation of instances happen
					if (tinyInstance &&
						tinyInstance.getDoc()
					) {
						tinyInstance.setContent(viewValue);
						// Triggering change event due to TinyMCE not firing event &
						// becoming out of sync for change callbacks
						tinyInstance.fire('change');
					}
				};

				ngModel.$validators.empty = function (modelValue, viewValue) {

					_initValidation();

					if (!attrs.required)
						return true;

					ensureInstance();
					if (!tinyInstance)
						return true;

					var content = tinyInstance.getContent({format: 'text'});
					if (!content || content.trim() == '') {
						return false;
					}
					return true;
				};

				//$timeout(function () {
				//	ngModel.$validate();
				//});

				function _initValidation() {
					ensureInstance();
					if (!tinyInstance)
						return;
					var el = angular.element(tinyInstance.getContainer());
					//var validClass = "editor-success", invalidClass = "editor-error";

					ngModel.inFocus = function () {
						return inFocus;
					};

					ngModel.setFocus = function () {
						if (tinyInstance)
							tinyInstance.focus();
					};

					ngModel.setElement(el);

				};

				attrs.$observe('required', function (required) {
					ngModel.$validate();
				});


				attrs.$observe('disabled', toggleDisable);

				// This block is because of TinyMCE not playing well with removal and
				// recreation of instances, requiring instances to have different
				// selectors in order to render new instances properly
				scope.$on('$tinymce:refresh', function (e, id) {
					var eid = attrs.id;
					if (angular.isUndefined(id) || id === eid) {
						var parentElement = element.parent();
						var clonedElement = element.clone();
						clonedElement.removeAttr('id');
						clonedElement.removeAttr('style');
						clonedElement.removeAttr('aria-hidden');
						tinymce.execCommand('mceRemoveEditor', false, eid);
						parentElement.append($compile(clonedElement)(scope));
					}
				});

				scope.$on('$destroy', function () {
					ensureInstance();

					if (tinyInstance) {
						tinyInstance.remove();
						tinyInstance = null;
					}
				});

				function ensureInstance() {
					if (!tinyInstance) {
						tinyInstance = tinymce.get(attrs.id);
					}
				}
			}
		};
	}]);
