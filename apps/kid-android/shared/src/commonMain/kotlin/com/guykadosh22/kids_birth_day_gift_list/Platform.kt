package com.guykadosh22.kids_birth_day_gift_list

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform