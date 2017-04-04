angular
  .module('walletApp')
  .controller('BuySellCtrl', BuySellCtrl);

function BuySellCtrl ($rootScope, $scope, $state, Alerts, Wallet, currency, buySell, MyWallet, $cookies, $q, options, $stateParams, modals) {
  $scope.buySellStatus = buySell.getStatus;
  $scope.trades = buySell.trades;

  $scope.status = {
    loading: false,
    modalOpen: false
  };

  $scope.walletStatus = Wallet.status;
  $scope.status.metaDataDown = $scope.walletStatus.isLoggedIn && !$scope.buySellStatus().metaDataService;

  $scope.tradeLimit = 5;
  $scope.scrollTrades = () => { $scope.tradeLimit += 5; };

  $scope.onCloseModal = () => {
    $scope.status.modalOpen = false;
    $scope.kyc = buySell.kycs[0];
    buySell.pollKYC();
  };

  $scope.initialize = () => {
    $scope.currencies = currency.coinifyCurrencies;
    $scope.settings = Wallet.settings;
    $scope.transaction = { fiat: undefined, currency: buySell.getCurrency() };
    $scope.sellTransaction = { fiat: undefined, currency: buySell.getCurrency() };
    $scope.currencySymbol = currency.conversions[$scope.transaction.currency.code];
    $scope.sellCurrencySymbol = currency.conversions[$scope.sellTransaction.currency.code];
    $scope.limits = {card: {}, bank: {}};
    $scope.sellLimits = {card: {}, bank: {}};
    $scope.state = {buy: true};
    $scope.rating = 0;

    $scope.buy = (trade, options) => {
      console.log('buySell Controller BUY', trade, options);
      if (!$scope.status.modalOpen) {
        $scope.status.modalOpen = true;
        modals.openBuyView(trade, options).result.finally($scope.onCloseModal);
      }
    };

    $scope.sell = (trade, options) => {
      console.log('sell from buy sell ctrl', trade, options); // NOTE trade will be kyc if passed in
      if (!$scope.status.modalOpen) {
        $scope.status.modalOpen = true;
        buySell.openSellView(trade, options).finally(() => {
          $scope.onCloseModal();
        });
      }
    };

    // for quote
    buySell.getExchange();

    $scope.$watch('settings.currency', () => {
      $scope.transaction.currency = buySell.getCurrency();
      $scope.sellTransaction.currency = buySell.getCurrency();
    }, true);

    $scope.$watch('transaction.currency', (newVal, oldVal) => {
      let curr = $scope.transaction.currency || null;
      $scope.currencySymbol = currency.conversions[curr.code];
      if (newVal !== oldVal) $scope.getMaxMin();
    });

    $scope.$watch('sellTransaction.currency', (newVal, oldVal) => {
      let curr = $scope.sellTransaction.currency || null;
      $scope.sellCurrencySymbol = currency.conversions[curr.code];
      if (newVal !== oldVal) $scope.getMaxMin(true);
    });

    if (buySell.getStatus().metaDataService && buySell.getExchange().user) {
      $scope.status.loading = true;
      $scope.exchange = buySell.getExchange();

      buySell.fetchProfile().then(() => {
        $scope.getMaxMin();

        let getCurrencies = buySell.getExchange().getBuyCurrencies().then(currency.updateCoinifyCurrencies);

        let getTrades = buySell.getTrades().then(() => {
          let pending = buySell.trades.pending;
          $scope.pendingTrade = pending.sort((a, b) => b.id - a.id)[0];
        }).catch(() => {
          $scope.fetchTradeError = true;
        });

        let getKYCs = buySell.getKYCs().then(() => {
          $scope.kyc = buySell.kycs[0];
          if ($scope.exchange.profile) { // NOTE added .profile here
            if (+$scope.exchange.profile.level.name < 2) {
              if ($scope.kyc) {
                buySell.pollKYC();
              } else {
                buySell.getKYCs().then(kycs => {
                  if (kycs.length > 0) buySell.pollKYC();
                  $scope.kyc = kycs[0];
                });
              }
            }
          } else {
            $scope.$watch(buySell.getExchange, (ex) => $scope.exchange = ex);
          }
        }).catch(() => {
          $scope.fetchKYCError = true;
        });

        $q.all([getTrades, getKYCs, getCurrencies]).then(() => {
          $scope.status.loading = false;
          $scope.status.disabled = false;
        });
      }).catch(() => {
        $scope.status.loading = false;
        $scope.status.exchangeDown = true;
        $scope.$safeApply();
      });
    } else {
      $scope.status.disabled = false;
    }

    $scope.openKyc = () => {
      console.log($scope.kyc);
      ['declined', 'rejected', 'expired'].indexOf($scope.kyc.state) > -1
        ? buySell.triggerKYC().then(kyc => $scope.buy(kyc))
        : $scope.buy($scope.kyc);
    };

    $scope.openSellKyc = () => {
      if (!$scope.kyc) {
        buySell.triggerKYC().then(kyc => $scope.buy(kyc));
      } else {
        $scope.buy($scope.kyc);
      }
    };

    $scope.changeCurrency = (curr) => {
      if (curr && $scope.currencies.some(c => c.code === curr.code)) {
        $scope.transaction.currency = curr;
      }
    };

    $scope.changeSellCurrency = (curr) => {
      if (curr && $scope.currencies.some(c => c.code === curr.code)) {
        $scope.sellTransaction.currency = curr;
        $scope.sellCurrencySymbol = currency.conversions[curr.code];
      }
    };

    $scope.submitFeedback = (rating) => buySell.submitFeedback(rating);
  };

  let watchLogin;

  if (Wallet.status.isLoggedIn) {
    $scope.initialize();
  } else {
    watchLogin = $scope.$watch('status.isLoggedIn', (isLoggedIn) => {
      if (isLoggedIn) {
        $scope.initialize();
        watchLogin();
      }
    });
  }

  $scope.getMaxMin = (sell) => {
    let transaction = sell ? 'sellTransaction' : 'transaction';
    let limits = sell ? 'sellLimits' : 'limits';

    const calculateMin = (rate) => {
      $scope[limits].card.min = (rate * 10).toFixed(2);
    };

    const calculateMax = (rate) => {
      $scope[limits].bank.max = buySell.calculateMax(rate, 'bank').max;
      $scope[limits].card.max = buySell.calculateMax(rate, 'card').max;
      $scope[limits].currency = $scope.currencySymbol;
    };

    buySell.getRate('EUR', $scope[transaction].currency.code).then(calculateMin);
    buySell.getRate($scope.exchange.profile.defaultCurrency, $scope[transaction].currency.code).then(calculateMax);
  };

  $scope.getIsTradingDisabled = () => {
    let profile = $scope.exchange && $scope.exchange.profile;
    let disabled = options.partners.coinify.disabled;
    let canTrade = profile && profile.canTrade;

    return canTrade === false || disabled;
  };

  $scope.getIsTradingDisabledReason = () => {
    let disabled = options.partners.coinify.disabled;
    let profile = $scope.exchange && $scope.exchange.profile;
    let cannotTradeReason = profile && profile.cannotTradeReason;

    if (disabled) cannotTradeReason = 'disabled';

    return cannotTradeReason;
  };

  $scope.setSellLimits = () => {
    if ($scope.exchange._profile) {
      $scope.sellLimits = $scope.exchange._profile._currentLimits._bank._outRemaining;
    }
  };

  const ONE_DAY_MS = 86400000;

  $scope.getDays = () => {
    let profile = buySell.getExchange().profile;
    let verifyDate = profile && profile.canTradeAfter;
    return isNaN(verifyDate) ? 1 : Math.ceil((verifyDate - Date.now()) / ONE_DAY_MS);
  };

  let email = MyWallet.wallet.accountInfo.email;
  let walletOptions = options;
  $scope.canSeeSellTab = MyWallet.wallet.external.sellCheck(email, walletOptions);

  $scope.tabs = {
    selectedTab: $stateParams.selectedTab || 'BUY_BITCOIN',
    options: $rootScope.inMobileBuy || !$scope.canSeeSellTab
      ? ['BUY_BITCOIN', 'ORDER_HISTORY']
      : ['BUY_BITCOIN', 'SELL_BITCOIN', 'ORDER_HISTORY'],
    select (tab) { this.selectedTab = this.selectedTab ? tab : null; }
  };

  $rootScope.$on('fetchExchangeProfile', () => {
    $scope.status.disabled = true;
    $scope.initialize();
  });
}
