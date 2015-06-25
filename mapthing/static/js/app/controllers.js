// vim: set ts=2 sts=2 sw=2 :
'use strict';

angular.module('mapApp.controllers', [])
    .controller('mapController', function($scope) {
      $scope.params = $scope.params || {};
      $scope.params.start = params.start;
      $scope.params.end = params.end;
    })
