package com.guykadosh22.kids_birth_day_gift_list.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.guykadosh22.kids_birth_day_gift_list.data.ApiException
import com.guykadosh22.kids_birth_day_gift_list.data.CatalogFilter
import com.guykadosh22.kids_birth_day_gift_list.data.HomeSummary
import com.guykadosh22.kids_birth_day_gift_list.data.KidProfile
import com.guykadosh22.kids_birth_day_gift_list.data.ListCreate
import com.guykadosh22.kids_birth_day_gift_list.data.ListDetail
import com.guykadosh22.kids_birth_day_gift_list.data.ListSummary
import com.guykadosh22.kids_birth_day_gift_list.data.ListUpdate
import com.guykadosh22.kids_birth_day_gift_list.data.Product
import com.guykadosh22.kids_birth_day_gift_list.data.ProfileUpdate
import com.guykadosh22.kids_birth_day_gift_list.data.Repository
import com.guykadosh22.kids_birth_day_gift_list.data.ShopFilterItem
import com.guykadosh22.kids_birth_day_gift_list.data.SignupRequest
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.EnglishStrings
import com.guykadosh22.kids_birth_day_gift_list.ui.theme.Strings
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Error(val error: Throwable) : UiState<Nothing>
    data class Ready<T>(val data: T) : UiState<T>
}

/** Kid-friendly error text for common API error codes. */
fun errorMessage(e: Throwable, s: Strings): String {
    val en = s === EnglishStrings
    val code = (e as? ApiException)?.code
    val status = (e as? ApiException)?.status
    return when {
        e is ApiException && e.isNetwork -> s.networkError
        code == "email_taken" -> if (en) "This email is already registered" else "המייל הזה כבר רשום"
        code == "unauthorized" && status == 401 -> if (en) "Wrong email or password" else "המייל או הסיסמה לא נכונים"
        code == "rate_limited" -> if (en) "Too many tries. Wait a few minutes." else "יותר מדי ניסיונות. חכו כמה דקות."
        code == "validation_failed" -> if (en) "Some fields are not filled in correctly" else "חלק מהשדות לא מולאו נכון"
        code == "consent_required" -> s.consentNeeded
        code == "already_purchased" -> if (en) "This gift was already bought" else "המתנה הזאת כבר נקנתה"
        code == "list_full" -> if (en) "A list can have up to 60 gifts" else "אפשר עד 60 מתנות ברשימה"
        else -> e.message ?: s.errorTitle
    }
}

class SessionViewModel(val repo: Repository) : ViewModel() {
    private val _loggedIn = MutableStateFlow(repo.api.isLoggedIn)
    val loggedIn: StateFlow<Boolean> = _loggedIn.asStateFlow()
    private val _profile = MutableStateFlow<KidProfile?>(null)
    val profile: StateFlow<KidProfile?> = _profile.asStateFlow()

    init {
        repo.api.onSessionExpired = { _loggedIn.value = false; _profile.value = null }
        if (_loggedIn.value) refreshProfile()
    }

    fun onLoggedIn() {
        _loggedIn.value = true
        refreshProfile()
    }

    fun refreshProfile() = viewModelScope.launch {
        runCatching { repo.me() }.onSuccess { _profile.value = it }
    }

    fun setProfile(p: KidProfile) { _profile.value = p }

    fun logout() = viewModelScope.launch {
        repo.logout()
        _profile.value = null
        _loggedIn.value = false
    }

    fun onAccountDeleted() {
        _profile.value = null
        _loggedIn.value = false
    }
}

class AuthViewModel(private val repo: Repository) : ViewModel() {
    val busy = MutableStateFlow(false)
    val error = MutableStateFlow<Throwable?>(null)
    val info = MutableStateFlow<String?>(null)

    fun login(email: String, password: String, onDone: () -> Unit) = run { repo.login(email, password); onDone() }
    fun signup(req: SignupRequest, onDone: () -> Unit) = run { repo.signup(req); onDone() }
    fun forgot(email: String, sentText: String) = run { repo.forgotPassword(email); info.value = sentText }

    private fun run(block: suspend () -> Unit) {
        if (busy.value) return
        viewModelScope.launch {
            busy.value = true
            error.value = null
            runCatching { block() }.onFailure { error.value = it }
            busy.value = false
        }
    }
}

class HomeViewModel(private val repo: Repository) : ViewModel() {
    private val _state = MutableStateFlow<UiState<HomeSummary>>(UiState.Loading)
    val state = _state.asStateFlow()
    init { load() }
    fun load(silent: Boolean = false) = viewModelScope.launch {
        if (!silent) _state.value = UiState.Loading
        _state.value = runCatching { repo.home() }.fold({ UiState.Ready(it) }, { UiState.Error(it) })
    }
    fun markRead() = viewModelScope.launch { runCatching { repo.markActivityRead() } }
    suspend fun share(listId: String): ListSummary = repo.enableShare(listId)
}

class ListsViewModel(private val repo: Repository) : ViewModel() {
    private val _state = MutableStateFlow<UiState<List<ListSummary>>>(UiState.Loading)
    val state = _state.asStateFlow()
    init { load() }
    fun load() = viewModelScope.launch {
        _state.value = UiState.Loading
        _state.value = runCatching { repo.lists() }.fold({ UiState.Ready(it) }, { UiState.Error(it) })
    }
    fun delete(id: String, onError: (Throwable) -> Unit) = viewModelScope.launch {
        val before = (_state.value as? UiState.Ready)?.data
        before?.let { _state.value = UiState.Ready(it.filterNot { l -> l.id == id }) } // optimistic
        runCatching { repo.deleteList(id) }.onFailure { e ->
            before?.let { _state.value = UiState.Ready(it) }
            onError(e)
        }
    }
}

class NewListViewModel(private val repo: Repository) : ViewModel() {
    val busy = MutableStateFlow(false)
    val error = MutableStateFlow<Throwable?>(null)
    fun create(req: ListCreate, onCreated: (ListDetail) -> Unit) {
        if (busy.value) return
        viewModelScope.launch {
            busy.value = true
            error.value = null
            runCatching { repo.createList(req) }.onSuccess(onCreated).onFailure { error.value = it }
            busy.value = false
        }
    }
}

data class EditState(
    val list: UiState<ListDetail> = UiState.Loading,
    val catalog: UiState<List<Product>> = UiState.Loading,
    val shops: List<ShopFilterItem> = emptyList(),
    val filter: CatalogFilter = CatalogFilter(),
    val busyProductIds: Set<String> = emptySet(),
    val shareBusy: Boolean = false,
)

class EditListViewModel(private val repo: Repository, val listId: String) : ViewModel() {
    private val _state = MutableStateFlow(EditState())
    val state = _state.asStateFlow()
    val messages = MutableStateFlow<Throwable?>(null)
    private var searchJob: Job? = null

    init {
        loadList()
        loadCatalog()
        viewModelScope.launch { runCatching { repo.shops() }.onSuccess { s -> _state.update { it.copy(shops = s) } } }
    }

    fun loadList() = viewModelScope.launch {
        _state.update { it.copy(list = UiState.Loading) }
        val r = runCatching { repo.list(listId) }.fold({ UiState.Ready(it) }, { UiState.Error(it) })
        _state.update { it.copy(list = r) }
    }

    fun loadCatalog() {
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(250) // debounce typing
            _state.update { it.copy(catalog = UiState.Loading) }
            val r = runCatching { repo.catalog(_state.value.filter) }.fold({ UiState.Ready(it) }, { UiState.Error(it) })
            _state.update { it.copy(catalog = r) }
        }
    }

    fun setFilter(f: CatalogFilter) {
        _state.update { it.copy(filter = f) }
        loadCatalog()
    }

    fun toggle(product: Product) {
        val list = (_state.value.list as? UiState.Ready)?.data ?: return
        if (product.id in _state.value.busyProductIds) return
        val item = list.items.firstOrNull { it.product.id == product.id }
        if (item?.purchased == true) return
        _state.update { it.copy(busyProductIds = it.busyProductIds + product.id) }
        viewModelScope.launch {
            runCatching { if (item != null) repo.removeItem(listId, product.id) else repo.addItem(listId, product.id) }
                .onSuccess { updated -> _state.update { it.copy(list = UiState.Ready(updated)) } }
                .onFailure { messages.value = it }
            _state.update { it.copy(busyProductIds = it.busyProductIds - product.id) }
        }
    }

    fun updateDetails(update: ListUpdate) = viewModelScope.launch {
        runCatching { repo.updateList(listId, update) }
            .onSuccess { updated -> _state.update { it.copy(list = UiState.Ready(updated)) } }
            .onFailure { messages.value = it }
    }

    fun share(action: ShareAction, onResult: (ListSummary) -> Unit = {}) = viewModelScope.launch {
        _state.update { it.copy(shareBusy = true) }
        runCatching {
            when (action) {
                ShareAction.Enable -> repo.enableShare(listId)
                ShareAction.Regenerate -> repo.regenerateShare(listId)
                ShareAction.Disable -> repo.disableShare(listId)
            }
        }.onSuccess { summary ->
            _state.update { st ->
                val cur = (st.list as? UiState.Ready)?.data
                st.copy(list = if (cur != null) UiState.Ready(cur.copy(share = summary.share)) else st.list)
            }
            onResult(summary)
        }.onFailure { messages.value = it }
        _state.update { it.copy(shareBusy = false) }
    }

    fun resendConsent(onDone: () -> Unit) = viewModelScope.launch {
        runCatching { repo.resendConsent() }.onSuccess { onDone() }.onFailure { messages.value = it }
    }
}

enum class ShareAction { Enable, Regenerate, Disable }

class ProfileViewModel(private val repo: Repository) : ViewModel() {
    val busy = MutableStateFlow(false)
    val error = MutableStateFlow<Throwable?>(null)

    fun save(update: ProfileUpdate, onSaved: (KidProfile) -> Unit) {
        if (busy.value) return
        viewModelScope.launch {
            busy.value = true
            error.value = null
            runCatching { repo.updateProfile(update) }.onSuccess(onSaved).onFailure { error.value = it }
            busy.value = false
        }
    }

    fun deleteAccount(onDeleted: () -> Unit) = viewModelScope.launch {
        busy.value = true
        runCatching { repo.deleteAccount() }.onSuccess { onDeleted() }.onFailure { error.value = it }
        busy.value = false
    }

    fun resendConsent(onDone: () -> Unit) = viewModelScope.launch {
        runCatching { repo.resendConsent() }.onSuccess { onDone() }.onFailure { error.value = it }
    }
}
