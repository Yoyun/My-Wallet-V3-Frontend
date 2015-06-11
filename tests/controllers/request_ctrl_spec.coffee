describe "RequestCtrl", ->
  scope = undefined
  modalInstance =
    close: ->
    dismiss: ->
        
  beforeEach angular.mock.module("walletApp")
  
  beforeEach ->
    angular.mock.inject ($injector, localStorageService, $controller, $rootScope) ->
      localStorageService.remove("mockWallets")
      
      Wallet = $injector.get("Wallet")      
            
      MyWallet = $injector.get("MyWallet")
      
      Wallet.login("test", "test")  
    
      scope = $rootScope.$new()
      
      $controller "RequestCtrl",
        $scope: scope,
        $stateParams: {},
        $modalInstance: modalInstance
        destination: undefined
    
      # Trigger generation of payment address:
      scope.fields.amount = "1"
      scope.$apply()
    
      return
      

    return
    
  describe "destinations", ->
    it "should include accounts",  ->
      expect(scope.destinations.length).toBeGreaterThan(0)
      expect(scope.destinations[0].index).toBeDefined()
      
    it "should not include archived accounts",  inject((Wallet) ->
      # Make sure there's an archived account in the mocks:
      match = false
      for account in scope.accounts
        match = true if !account.active
        
      expect(match).toBe(true, "No archived account in mocks")
      
      # Test that this archived account is not included in origins:
      for destination in scope.destinations
        expect(destination.active).not.toBe(false, "Archived account in destinations")
    )
    
  describe "when requesting for a legacy address", ->
    
    it "should select the users currency by default", inject((Wallet)->
      expect(Wallet.settings.currency.code).toBe("USD")
      expect(scope.fields.currency.code).toBe "USD"
    )

    it "should have a bit currency", inject((Wallet)->
      expect(scope.settings.btcCurrency).toBeDefined()
    )
    
    it "should have access to legacy addresses",  inject(() ->
      expect(scope.legacyAddresses).toBeDefined()
      expect(scope.legacyAddresses.length).toBeGreaterThan(0)
    )
    
    it "should combine accounts and active legacy addresses in destinations", ->
      expect(scope.destinations).toBeDefined()
      
      foundAccount = false
      foundLegacyAddress = false
      
      for destination in scope.destinations
        foundAccount = true if destination.index?
        foundLegacyAddress = true if !destination.index?      
      
      expect(foundAccount).toBe(true)    
      expect(foundLegacyAddress).toBe(true)      
    
    it "should close", inject((Wallet) ->
      spyOn(Wallet, "clearAlerts")
      scope.close()
      expect(Wallet.clearAlerts).toHaveBeenCalled()
    )

    it "should show a payment request address when legacy address is selected", inject(()->
      scope.fields.to = scope.destinations[scope.accounts.length] # The first legacy address
      
      scope.$digest()
      
      expect(scope.paymentRequestAddress).toBe(scope.fields.to.address)
    )
      
    it "should show a payment URL when legacy address is selected", ->
      scope.fields.to = scope.destinations[scope.accounts.length] # The first legacy address
      scope.$digest()
      expect(scope.paymentRequestURL).toBeDefined()
      expect(scope.paymentRequestURL).toContain("bitcoin:")
      
      
    it "should show a payment URL with amount when legacy address is selected and amount > 0", ->
      scope.fields.to = scope.destinations[scope.accounts.length] # The first legacy address
      scope.$digest()
      scope.fields.currency = scope.currencies[0]
      scope.fields.amount = "0.1"
      scope.$digest()
      expect(scope.paymentRequestURL).toBeDefined()
      expect(scope.paymentRequestURL).toContain("amount=0.1")      
      
    it "should not have amount argument in URL if amount is zero, null or empty", ->
      scope.fields.to = scope.destinations[scope.accounts.length] # The first legacy address
      scope.fields.amount = "0"
      scope.$digest()
      expect(scope.paymentRequestURL).toBeDefined()
      expect(scope.paymentRequestURL).not.toContain("amount=")
      
      scope.fields.amount = null
      scope.$digest()
      expect(scope.paymentRequestURL).not.toContain("amount=")
      
      scope.fields.amount = ""
      scope.$digest()
      expect(scope.paymentRequestURL).not.toContain("amount=")
    
    it "should show the amount in BTC", ->
      expect(scope.currencies[4].code).toBe("EUR")
      scope.fields.currency = scope.currencies[4]
      scope.$digest()
      expect(scope.paymentRequestAmount).toBe(400000)

  describe "validate", ->

    it "should return false if 'to' is null", () ->
      scope.fields.to = null
      expect(scope.validate()).toBe(false)

    it "should return false if 'amount' is not a number", () ->
      scope.fields.amount = 'asdf'
      expect(scope.validate()).toBe(false)

    it "should return false if 'amount' is negative", () ->
      scope.fields.amount = -69
      expect(scope.validate()).toBe(false)

    it "should return false if 'amount' has too many decimal places (btc)", () ->
      scope.fields.amount = '0.000000001'
      scope.fields.currency = {code: 'BTC'}
      expect(scope.validate()).toBe(false)

    it "should return false if 'amount' has too many decimal places (fiat)", () ->
      scope.fields.amount = '0.001'
      scope.fields.currency = {code: 'USD'}
      expect(scope.validate()).toBe(false)

  describe "allowedDecimals", ->

    it "should return 8 if the currency is a btc currency", () ->
      scope.fields.currency = {code: 'mBTC'}
      expect(scope.allowedDecimals()).toBe(8)

    it "should return 2 if the currency is fiat", () ->
      scope.fields.currency = {code: 'USD'}
      expect(scope.allowedDecimals()).toBe(2)